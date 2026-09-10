-- VEDARA admin data access
-- Run after 0005_order_workflows.sql.
-- Table grants allow the authenticated role to reach the Data API; RLS below
-- still limits all writes to users whose profiles.is_admin is true.

grant select, insert, update, delete on
  public.categories,
  public.products,
  public.product_images,
  public.product_variants,
  public.inventory,
  public.coupons,
  public.orders,
  public.order_items,
  public.reviews,
  public.contact_enquiries
  to authenticated;

drop policy if exists "vedara contact: admin delete" on public.contact_enquiries;
create policy "vedara contact: admin delete" on public.contact_enquiries
  for delete using (public.vedara_is_admin());

-- Keep storage deletes scoped to the VEDARA bucket and admin role.
drop policy if exists "vedara product images: admin delete" on storage.objects;
create policy "vedara product images: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.vedara_is_admin());
