-- VEDARA order workflows
-- Run after 0004_admin.sql. Customer cancellation is ownership-checked in the database.

create or replace function public.customer_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item record;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_order.status::text not in ('pending', 'confirmed') then
    raise exception 'ORDER_CANNOT_BE_CANCELLED' using errcode = 'P0001';
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;

  for v_item in select product_id, quantity from public.order_items where order_id = p_order_id loop
    update public.products
    set stock = coalesce(stock, 0) + v_item.quantity
    where id = v_item.product_id and stock is not null;
  end loop;
end;
$$;

grant execute on function public.customer_cancel_order(uuid) to authenticated;
