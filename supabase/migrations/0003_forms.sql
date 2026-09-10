-- ============================================================================
-- VEDARA — richer form data (checkout address, contact fields, newsletter)
-- ----------------------------------------------------------------------------
-- Run AFTER 0002_commerce.sql. Idempotent. Shared-project safe.
--
--   * orders            + customer_name, phone, notes
--   * contact_enquiries + phone, subject
--   * newsletter_subscribers  (new)
--   * place_order()  updated to persist the new order fields
-- ============================================================================

-- ---------------------------------------------------------------------------
-- orders — capture the full checkout details
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists phone         text;
alter table public.orders add column if not exists notes         text;

-- ---------------------------------------------------------------------------
-- contact_enquiries — phone + free-text subject
-- ---------------------------------------------------------------------------
alter table public.contact_enquiries add column if not exists phone   text;
alter table public.contact_enquiries add column if not exists subject text;

-- ---------------------------------------------------------------------------
-- newsletter_subscribers
-- ---------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  source      text,
  created_at  timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "vedara newsletter: anyone subscribes" on public.newsletter_subscribers;
drop policy if exists "vedara newsletter: admin reads"       on public.newsletter_subscribers;

create policy "vedara newsletter: anyone subscribes" on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);
create policy "vedara newsletter: admin reads" on public.newsletter_subscribers
  for select using (public.vedara_is_admin());

grant insert on public.newsletter_subscribers to anon, authenticated;
grant select, update, delete on public.newsletter_subscribers to authenticated;

-- ---------------------------------------------------------------------------
-- place_order() — same signature, now also stores customer_name / phone / notes
-- (pulled out of the p_shipping json so the RPC contract is unchanged).
-- ---------------------------------------------------------------------------
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
    v_qty := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));
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

  -- 2. coupon (re-validated; ignored silently if it no longer qualifies)
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

  -- 3. shipping — complimentary over 2500 (post-discount), else 250
  v_shipping := case when (v_subtotal - v_discount) >= 2500 then 0 else 250 end;

  -- 4. create the order
  insert into public.orders
    (user_id, email, customer_name, phone, notes, status,
     subtotal, discount, shipping, total, coupon_id, shipping_address)
  values
    (v_user, p_email,
     nullif(trim(coalesce(p_shipping ->> 'fullName', '')), ''),
     nullif(trim(coalesce(p_shipping ->> 'phone', '')), ''),
     nullif(trim(coalesce(p_shipping ->> 'notes', '')), ''),
     'pending',
     v_subtotal, v_discount, v_shipping,
     v_subtotal - v_discount + v_shipping, v_coupon.id,
     coalesce(p_shipping, '{}'::jsonb))
  returning * into v_order;

  -- 5. line items + stock decrement
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));
    v_size := v_item ->> 'size';
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
