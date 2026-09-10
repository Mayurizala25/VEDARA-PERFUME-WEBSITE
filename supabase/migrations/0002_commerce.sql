-- ============================================================================
-- VEDARA — commerce layer (contact enquiries, coupon validation, checkout RPC)
-- ----------------------------------------------------------------------------
-- Run AFTER 0001_initial_schema.sql. Idempotent. Shared-project safe
-- (all new objects are VEDARA-owned; nothing else is touched).
--
-- Adds:
--   * public.contact_enquiries        — the Contact form target
--   * public.validate_coupon(text)    — server-side coupon check (codes stay private)
--   * public.place_order(...)         — atomic checkout: validates stock, computes
--                                       totals server-side, writes order + items,
--                                       decrements stock, clears the cart
-- ============================================================================

-- ===========================================================================
-- contact_enquiries
-- ===========================================================================
create table if not exists public.contact_enquiries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null,
  email       text not null,
  topic       text,
  message     text not null,
  status      text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_contact_enquiries_created on public.contact_enquiries (created_at desc);

drop trigger if exists trg_contact_enquiries_updated on public.contact_enquiries;
create trigger trg_contact_enquiries_updated before update on public.contact_enquiries
  for each row execute function public.vedara_set_updated_at();

alter table public.contact_enquiries enable row level security;

drop policy if exists "vedara contact: anyone submits" on public.contact_enquiries;
drop policy if exists "vedara contact: admin reads"    on public.contact_enquiries;
drop policy if exists "vedara contact: admin manage"   on public.contact_enquiries;

-- Anyone (signed in or not) may submit an enquiry through the contact form.
create policy "vedara contact: anyone submits" on public.contact_enquiries
  for insert to anon, authenticated with check (true);
-- Only admins can read / update / delete them.
create policy "vedara contact: admin reads" on public.contact_enquiries
  for select using (public.vedara_is_admin());
create policy "vedara contact: admin manage" on public.contact_enquiries
  for update using (public.vedara_is_admin()) with check (public.vedara_is_admin());

grant insert on public.contact_enquiries to anon, authenticated;
grant select, update, delete on public.contact_enquiries to authenticated;

-- ===========================================================================
-- validate_coupon(code)  ->  jsonb
-- SECURITY DEFINER so the coupons table stays admin-only but the storefront
-- can still check a single code the customer typed.
-- ===========================================================================
create or replace function public.validate_coupon(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.coupons;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return jsonb_build_object('valid', false, 'message', 'Enter a promo code.');
  end if;

  select * into c from public.coupons where upper(code) = upper(trim(p_code)) limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'That code is not recognised.');
  end if;
  if not c.active then
    return jsonb_build_object('valid', false, 'message', 'That code is no longer active.');
  end if;
  if c.starts_at is not null and now() < c.starts_at then
    return jsonb_build_object('valid', false, 'message', 'That code is not active yet.');
  end if;
  if c.expires_at is not null and now() > c.expires_at then
    return jsonb_build_object('valid', false, 'message', 'That code has expired.');
  end if;
  if c.usage_limit is not null and c.times_used >= c.usage_limit then
    return jsonb_build_object('valid', false, 'message', 'That code has reached its limit.');
  end if;

  return jsonb_build_object(
    'valid', true,
    'code', c.code,
    'description', c.description,
    'discount_type', c.discount_type,
    'discount_value', c.discount_value,
    'min_subtotal', c.min_subtotal
  );
end;
$$;

grant execute on function public.validate_coupon(text) to anon, authenticated;

-- ===========================================================================
-- place_order(items, email, shipping, coupon)  ->  jsonb
-- The one and only client entry point for creating an order. Runs as owner
-- (SECURITY DEFINER) but authorises against auth.uid() and recomputes every
-- price / total from the products table so the client cannot tamper.
--   p_items:    [{ "slug": "oudh-noir", "size": "50ml", "quantity": 2 }, ...]
--   p_shipping: { "firstName": "...", "address": "...", ... }  (stored as-is)
-- ===========================================================================
create or replace function public.place_order(
  p_items jsonb,
  p_email text,
  p_shipping jsonb default '{}'::jsonb,
  p_coupon text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_order    public.orders;
  v_item     jsonb;
  v_product  public.products;
  v_qty      integer;
  v_size     text;
  v_subtotal numeric(10, 2) := 0;
  v_discount numeric(10, 2) := 0;
  v_shipping numeric(10, 2) := 0;
  v_coupon   public.coupons;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  -- 1. validate stock + accumulate subtotal from authoritative prices
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));
    select * into v_product from public.products
      where slug = (v_item ->> 'slug') and status = 'active';
    if not found then
      raise exception 'PRODUCT_UNAVAILABLE:%', (v_item ->> 'slug') using errcode = 'P0001';
    end if;
    if v_product.stock is not null and v_product.stock < v_qty then
      raise exception 'OUT_OF_STOCK:%', v_product.name using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  -- 2. coupon (re-validated here; ignored silently if it no longer qualifies)
  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into v_coupon from public.coupons
      where upper(code) = upper(trim(p_coupon))
        and active = true
        and (starts_at is null or now() >= starts_at)
        and (expires_at is null or now() <= expires_at)
        and (usage_limit is null or times_used < usage_limit)
      limit 1;
    if found and v_subtotal >= coalesce(v_coupon.min_subtotal, 0) then
      if v_coupon.discount_type = 'percent' then
        v_discount := round(v_subtotal * v_coupon.discount_value / 100.0);
      else
        v_discount := least(v_coupon.discount_value, v_subtotal);
      end if;
    else
      v_coupon := null;
    end if;
  end if;

  -- 3. shipping — complimentary over ₹2,500 (post-discount), else ₹250
  v_shipping := case when (v_subtotal - v_discount) >= 2500 then 0 else 250 end;

  -- 4. create the order
  insert into public.orders
    (user_id, email, status, subtotal, discount, shipping, total, coupon_id, shipping_address)
  values
    (v_user, p_email, 'pending', v_subtotal, v_discount, v_shipping,
     v_subtotal - v_discount + v_shipping, v_coupon.id, coalesce(p_shipping, '{}'::jsonb))
  returning * into v_order;

  -- 5. line items + stock decrement
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));
    v_size := coalesce(v_item ->> 'size', null);
    select * into v_product from public.products where slug = (v_item ->> 'slug');
    insert into public.order_items
      (order_id, product_id, name, size, unit_price, quantity)
    values
      (v_order.id, v_product.id, v_product.name, v_size, v_product.price, v_qty);
    if v_product.stock is not null then
      update public.products set stock = greatest(0, stock - v_qty) where id = v_product.id;
    end if;
  end loop;

  -- 6. bump coupon usage + clear the user's server cart
  if v_coupon.id is not null then
    update public.coupons set times_used = times_used + 1 where id = v_coupon.id;
  end if;
  delete from public.cart_items where user_id = v_user;

  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'email', v_order.email,
    'subtotal', v_order.subtotal,
    'discount', v_order.discount,
    'shipping', v_order.shipping,
    'total', v_order.total,
    'created_at', v_order.created_at
  );
end;
$$;

grant execute on function public.place_order(jsonb, text, jsonb, text) to authenticated;
