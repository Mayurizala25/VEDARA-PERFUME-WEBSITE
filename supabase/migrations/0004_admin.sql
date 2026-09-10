-- ============================================================================
-- VEDARA — owner admin panel support
-- ----------------------------------------------------------------------------
-- Run AFTER 0003_forms.sql. Idempotent. Shared-project safe.
--
--   * orders.status            → text with the fulfilment lifecycle check
--   * contact_enquiries.status  → New / Contacted / Resolved (+ legacy values)
--   * profiles.status           → active / suspended
--   * storage bucket `product-images` + RLS (public read, admin write)
--   * admin_dashboard_stats() / admin_sales_overview() / admin_best_sellers()
--   * admin_set_order_status()  (restores stock when an order is cancelled)
--
-- Every admin RPC checks public.vedara_is_admin() first. All existing tables
-- already carry an "admin all" RLS policy from 0001, so plain CRUD from an
-- admin session works without further changes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- orders.status — full fulfilment lifecycle
-- ---------------------------------------------------------------------------
alter table public.orders alter column status drop default;
alter table public.orders alter column status type text using status::text;
update public.orders set status = 'confirmed' where status = 'paid';
update public.orders set status = 'delivered' where status = 'fulfilled';
alter table public.orders alter column status set default 'pending';
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));

-- ---------------------------------------------------------------------------
-- contact_enquiries.status — New / Contacted / Resolved
-- ---------------------------------------------------------------------------
update public.contact_enquiries set status = 'contacted' where status = 'replied';
update public.contact_enquiries set status = 'resolved'  where status = 'archived';
alter table public.contact_enquiries drop constraint if exists contact_enquiries_status_check;
alter table public.contact_enquiries add constraint contact_enquiries_status_check
  check (status in ('new', 'contacted', 'resolved', 'read', 'replied', 'archived'));

-- ---------------------------------------------------------------------------
-- profiles.status — account state the owner can toggle
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('active', 'suspended'));

-- SECURITY: a customer's "update own row" RLS policy would otherwise let them
-- set their own is_admin / status. Column-level privileges close that — a
-- normal user can only touch their name + phone; is_admin / status move
-- through the admin RPCs below (which check vedara_is_admin()).
revoke insert, update on public.profiles from authenticated;
grant insert (id, email, full_name, phone) on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Storage — product image uploads
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

drop policy if exists "vedara product images: public read"  on storage.objects;
drop policy if exists "vedara product images: admin insert" on storage.objects;
drop policy if exists "vedara product images: admin update" on storage.objects;
drop policy if exists "vedara product images: admin delete" on storage.objects;

create policy "vedara product images: public read" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "vedara product images: admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.vedara_is_admin());
create policy "vedara product images: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.vedara_is_admin());
create policy "vedara product images: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.vedara_is_admin());

-- ---------------------------------------------------------------------------
-- Admin: dashboard aggregates
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.vedara_is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'revenue',          coalesce((select sum(total) from orders where status <> 'cancelled'), 0),
    'revenue_30d',      coalesce((select sum(total) from orders where status <> 'cancelled' and created_at >= now() - interval '30 days'), 0),
    'orders_total',     (select count(*) from orders),
    'orders_pending',   (select count(*) from orders where status in ('pending', 'confirmed', 'processing')),
    'orders_30d',       (select count(*) from orders where created_at >= now() - interval '30 days'),
    'products_total',   (select count(*) from products),
    'products_active',  (select count(*) from products where status = 'active'),
    'customers_total',  (select count(*) from profiles),
    'customers_30d',    (select count(*) from profiles where created_at >= now() - interval '30 days'),
    'low_stock',        (select count(*) from products where stock is not null and stock > 0 and stock <= 5),
    'out_of_stock',     (select count(*) from products where stock = 0),
    'reviews_pending',  (select count(*) from reviews where is_approved = false),
    'enquiries_new',    (select count(*) from contact_enquiries where status = 'new')
  );
end $$;
grant execute on function public.admin_dashboard_stats() to authenticated;

create or replace function public.admin_sales_overview(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.vedara_is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object('date', d::date, 'revenue', coalesce(r.revenue, 0), 'orders', coalesce(r.cnt, 0))
      order by d
    )
    from generate_series(current_date - (greatest(p_days, 1) - 1), current_date, interval '1 day') d
    left join (
      select date_trunc('day', created_at)::date dt, sum(total) revenue, count(*) cnt
      from orders
      where status <> 'cancelled' and created_at >= current_date - (greatest(p_days, 1) - 1)
      group by 1
    ) r on r.dt = d::date
  ), '[]'::jsonb);
end $$;
grant execute on function public.admin_sales_overview(integer) to authenticated;

create or replace function public.admin_best_sellers(p_limit integer default 5)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.vedara_is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select oi.product_id,
             coalesce(p.name, oi.name) as name,
             p.slug,
             sum(oi.quantity) as units,
             sum(oi.unit_price * oi.quantity) as revenue
      from order_items oi
      join orders o on o.id = oi.order_id
      left join products p on p.id = oi.product_id
      where o.status <> 'cancelled'
      group by oi.product_id, p.name, oi.name, p.slug
      order by units desc
      limit greatest(p_limit, 1)
    ) t
  ), '[]'::jsonb);
end $$;
grant execute on function public.admin_best_sellers(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: order status change (restores stock on cancellation)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old  text;
  v_line record;
begin
  if not public.vedara_is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_status not in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') then
    raise exception 'BAD_STATUS' using errcode = 'P0001';
  end if;

  select status into v_old from public.orders where id = p_order_id;
  if v_old is null then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001'; end if;

  update public.orders set status = p_status where id = p_order_id;

  if p_status = 'cancelled' and v_old <> 'cancelled' then
    for v_line in select product_id, quantity from public.order_items where order_id = p_order_id loop
      update public.products
        set stock = coalesce(stock, 0) + v_line.quantity
        where id = v_line.product_id and stock is not null;
    end loop;
  end if;
end $$;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: customer + admin-team management (bypasses the profiles column locks)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_customer_status(p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vedara_is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'BAD_STATUS' using errcode = 'P0001'; end if;
  update public.profiles set status = p_status where id = p_user_id;
end $$;
grant execute on function public.admin_set_customer_status(uuid, text) to authenticated;

create or replace function public.admin_set_admin(p_email text, p_is_admin boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.profiles;
begin
  if not public.vedara_is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update public.profiles set is_admin = p_is_admin
    where lower(email) = lower(trim(p_email))
    returning * into v_row;
  if v_row.id is null then raise exception 'NO_SUCH_USER' using errcode = 'P0001'; end if;
  return jsonb_build_object('id', v_row.id, 'email', v_row.email, 'is_admin', v_row.is_admin);
end $$;
grant execute on function public.admin_set_admin(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime — so an admin edit shows on the live customer site without a reload
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['products', 'product_images', 'categories'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
