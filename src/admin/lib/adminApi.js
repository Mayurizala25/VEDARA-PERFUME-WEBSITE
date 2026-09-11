/**
 * VEDARA admin — every Supabase read/write the owner panel needs.
 *
 * Uses the shared `supabase` client (the admin is just a signed-in user whose
 * profile has `is_admin = true`). RLS on the database enforces access; these
 * helpers only shape the queries. No service-role key is ever involved.
 */
import { supabase } from '../../lib/supabaseClient';

const IMAGE_BUCKET = 'product-images';

function throwErr(error) { if (error) throw new Error(error.message || 'Request failed'); }
function safeFilter(value) { return String(value || '').replace(/[%,()]/g, ' '); }

/* ============================================================ Dashboard */

export function validateCategoryImageFile(file) {
  if (!file) return null;
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(file.type)) {
    throw new Error('Only JPG, PNG, or WebP images are allowed.');
  }
  if (file.size <= 0) {
    throw new Error('The selected image is empty.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be 5 MB or smaller.');
  }
  return file;
}

export async function uploadCategoryImage(file) {
  const safeFile = validateCategoryImageFile(file);
  if (!safeFile) return '';

  const ext = (safeFile.name.split('.').pop() || 'jpg').toLowerCase();
  const bucketPath = `categories/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(IMAGE_BUCKET).upload(bucketPath, safeFile, {
    cacheControl: '3600',
    contentType: safeFile.type || undefined,
    upsert: false,
  });
  throwErr(upErr);

  const { data: pub } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(bucketPath);
  return pub.publicUrl;
}

export async function getDashboardStats() {
  const { data, error } = await supabase.rpc('admin_dashboard_stats');
  throwErr(error);
  return data || {};
}

export async function getSalesOverview(days = 30) {
  const { data, error } = await supabase.rpc('admin_sales_overview', { p_days: days });
  throwErr(error);
  return data || [];
}

export async function getBestSellers(limit = 5) {
  const { data, error } = await supabase.rpc('admin_best_sellers', { p_limit: limit });
  throwErr(error);
  return data || [];
}

export async function getRecentOrders(limit = 6) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, email, total, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  throwErr(error);
  return data || [];
}

export async function getRecentCustomers(limit = 6) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  throwErr(error);
  return data || [];
}

/* ============================================================= Products */

const PRODUCT_SELECT =
  '*, category:categories(id, name, slug), images:product_images(id, url, alt, sort_order, is_primary)';

export async function listProducts({ search = '', status = '', gender = '', category = '', filter = '', sort = 'created_at.desc', page = 1, pageSize = 20 } = {}) {
  const [col, dir] = sort.split('.');
  let q = supabase.from('products').select(PRODUCT_SELECT, { count: 'exact' });
  const cleanSearch = safeFilter(search);
  if (cleanSearch) q = q.or(`name.ilike.%${cleanSearch}%,sku.ilike.%${cleanSearch}%,slug.ilike.%${cleanSearch}%`);
  if (status) q = q.eq('status', status);
  if (gender) q = q.eq('gender', gender);
  if (category) q = q.eq('category_id', category);
  if (filter === 'low') q = q.gt('stock', 0).lte('stock', 5);
  if (filter === 'out') q = q.eq('stock', 0);
  q = q.order(col, { ascending: dir === 'asc' }).range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await q;
  throwErr(error);
  return { rows: (data || []).map(withSortedImages), count: count || 0 };
}

function withSortedImages(row) {
  const images = [...(row.images || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return { ...row, images, primaryImage: images.find((i) => i.is_primary) || images[0] || null };
}

export async function getProduct(id) {
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).single();
  throwErr(error);
  return withSortedImages(data);
}

export async function getProductBySlug(slug) {
  const { data } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
  return data;
}

const PRODUCT_FIELDS = [
  'name', 'slug', 'description', 'short_description', 'price', 'original_price', 'category_id',
  'gender', 'fragrance_type', 'family', 'top_notes', 'heart_notes', 'base_notes', 'sizes',
  'stock', 'sku', 'featured', 'best_seller', 'new_arrival', 'status', 'tone',
];

function cleanProduct(input) {
  const out = {};
  for (const f of PRODUCT_FIELDS) {
    if (input[f] === undefined) continue;
    let v = input[f];
    if (['price', 'original_price', 'stock'].includes(f)) v = v === '' || v === null ? null : Number(v);
    if (f === 'original_price' && (v === 0 || Number.isNaN(v))) v = null;
    if (typeof v === 'string') v = v.trim() || null;
    if (f === 'name' || f === 'slug' || f === 'price') v = input[f]; // keep required-ish raw
    out[f] = v;
  }
  if (out.name) out.name = String(out.name).trim();
  if (!out.slug && out.name) out.slug = slugify(out.name);
  if (out.slug) out.slug = slugify(out.slug);
  out.price = Number(input.price) || 0;
  out.stock = input.stock === '' || input.stock === null || input.stock === undefined ? 0 : Number(input.stock);
  out.sizes = Array.isArray(input.sizes) ? input.sizes : [];
  return out;
}

export function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function createProduct(input) {
  const { data, error } = await supabase.from('products').insert(cleanProduct(input)).select('id, slug').single();
  if (error) throw friendlyAdminError(error, 'Could not create product');
  return data;
}

export async function updateProduct(id, input) {
  const { data, error } = await supabase.from('products').update(cleanProduct(input)).eq('id', id).select('id, slug').single();
  if (error) throw friendlyAdminError(error, 'Could not save product');
  return data;
}

export async function syncProductVariants(productId, sizes, stock, basePrice) {
  const quantity = Math.max(0, Math.round(Number(stock) || 0));
  for (const size of sizes || []) {
    const { data: variant, error: variantError } = await supabase
      .from('product_variants')
      .upsert({ product_id: productId, size, price: Number(basePrice) || 0 }, { onConflict: 'product_id,size' })
      .select('id')
      .single();
    if (variantError) throw friendlyAdminError(variantError, 'Could not save product sizes');
    const { error: inventoryError } = await supabase
      .from('inventory')
      .upsert({ variant_id: variant.id, quantity, restock_threshold: 5 }, { onConflict: 'variant_id' });
    if (inventoryError) throw friendlyAdminError(inventoryError, 'Could not save inventory');
  }
}

export async function deleteProduct(id) {
  // best-effort: remove storage files for this product's images first
  const { data: imgs } = await supabase.from('product_images').select('url').eq('product_id', id);
  await removeStorageFiles((imgs || []).map((i) => i.url));
  const { error } = await supabase.from('products').delete().eq('id', id);
  throwErr(error);
}

export async function setProductFlags(id, patch) {
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  throwErr(error);
}

/* -------------------------------------------------- product images / storage */

function storagePathFromUrl(url) {
  const marker = `/object/public/${IMAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

async function removeStorageFiles(urls) {
  const paths = urls.map(storagePathFromUrl).filter(Boolean);
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
}

export async function uploadProductImage(productId, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: '3600', contentType: file.type || undefined, upsert: false,
  });
  throwErr(upErr);
  const { data: pub } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);

  const { count } = await supabase.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId);
  const { data, error } = await supabase.from('product_images').insert({
    product_id: productId, url: pub.publicUrl, alt: '', sort_order: count || 0, is_primary: (count || 0) === 0,
  }).select().single();
  throwErr(error);
  return data;
}

export async function addImageByUrl(productId, url) {
  const { count } = await supabase.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId);
  const { data, error } = await supabase.from('product_images').insert({
    product_id: productId, url: url.trim(), alt: '', sort_order: count || 0, is_primary: (count || 0) === 0,
  }).select().single();
  throwErr(error);
  return data;
}

export async function deleteProductImage(image) {
  await removeStorageFiles([image.url]);
  const { error } = await supabase.from('product_images').delete().eq('id', image.id);
  throwErr(error);
}

export async function setPrimaryImage(productId, imageId) {
  await supabase.from('product_images').update({ is_primary: false }).eq('product_id', productId);
  const { error } = await supabase.from('product_images').update({ is_primary: true }).eq('id', imageId);
  throwErr(error);
}

export async function reorderImages(ordered) {
  for (let i = 0; i < ordered.length; i += 1) {
    const { error } = await supabase.from('product_images').update({ sort_order: i }).eq('id', ordered[i].id);
    throwErr(error);
  }
}

/* =========================================================== Categories */

export async function listCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*, product_count:products(count)')
    .order('sort_order', { ascending: true });
  throwErr(error);
  return (data || []).map((c) => ({ ...c, product_count: c.product_count?.[0]?.count ?? 0 }));
}

export async function createCategory(input) {
  const body = {
    name: input.name?.trim(),
    slug: slugify(input.slug || input.name),
    description: input.description?.trim() || null,
    image_url: input.image_url?.trim() || null,
    sort_order: Number(input.sort_order) || 0,
  };
  const { data, error } = await supabase.from('categories').insert(body).select().single();
  if (error) throw friendlyAdminError(error, 'Could not create category');
  return data;
}

export async function updateCategory(id, input) {
  const body = {
    name: input.name?.trim(),
    slug: slugify(input.slug || input.name),
    description: input.description?.trim() || null,
    image_url: input.image_url?.trim() || null,
    sort_order: Number(input.sort_order) || 0,
  };
  const { data, error } = await supabase.from('categories').update(body).eq('id', id).select().single();
  if (error) throw friendlyAdminError(error, 'Could not save category');
  return data;
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  throwErr(error);
}

function friendlyAdminError(error, fallback) {
  const message = error?.message || '';
  if (error?.code === '42501' || /permission denied|row-level security/i.test(message)) {
    return new Error('Your account is not authorised for this admin action.');
  }
  if (error?.code === '23505' || /duplicate key|unique constraint/i.test(message)) {
    return new Error('A record with that name, slug, SKU, or code already exists.');
  }
  return new Error(message || fallback);
}

/* =============================================================== Orders */

export async function listOrders({ search = '', status = '', sort = 'created_at.desc', dateFrom = '', dateTo = '', page = 1, pageSize = 20 } = {}) {
  const [col, dir] = sort.split('.');
  let q = supabase.from('orders').select('*, items:order_items(quantity, name, product:products(name, product_images(url, alt, is_primary)))', { count: 'exact' });
  if (search) {
    const safeSearch = search.replace(/[%,()]/g, ' ');
    const { data: matchingItems, error: itemError } = await supabase.from('order_items').select('order_id').ilike('name', `%${safeSearch}%`);
    throwErr(itemError);
    const ids = (matchingItems || []).map((item) => item.order_id);
    const clauses = [`order_number.ilike.%${safeSearch}%`, `customer_name.ilike.%${safeSearch}%`, `phone.ilike.%${safeSearch}%`, `email.ilike.%${safeSearch}%`];
    if (ids.length) clauses.push(`id.in.(${ids.join(',')})`);
    q = q.or(clauses.join(','));
  }
  if (status) q = q.eq('status', status);
  if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`);
  if (dateTo) {
    const upper = new Date(`${dateTo}T00:00:00`);
    upper.setDate(upper.getDate() + 1);
    q = q.lt('created_at', upper.toISOString());
  }
  q = q.order(col, { ascending: dir === 'asc' }).range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await q;
  throwErr(error);
  return {
    rows: (data || []).map((o) => ({
      ...o,
      item_count: (o.items || []).reduce((n, i) => n + i.quantity, 0),
      first_item: o.items?.[0] || null,
    })),
    count: count || 0,
  };
}

export async function getOrderSummary({ dateFrom = '', dateTo = '' } = {}) {
  let q = supabase.from('orders').select('status, total');
  if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`);
  if (dateTo) q = q.lt('created_at', `${dateTo}T00:00:00`);
  const { data, error } = await q;
  throwErr(error);
  return (data || []).reduce((summary, order) => {
    const status = String(order.status || '').toLowerCase();
    summary.total += 1;
    summary.revenue += status === 'cancelled' ? 0 : Number(order.total) || 0;
    if (summary[status] !== undefined) summary[status] += 1;
    return summary;
  }, { total: 0, pending: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, revenue: 0 });
}

export async function getOrder(id) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*, product:products(name, slug, product_images(url, alt, is_primary))), coupon:coupons(code, discount_type, discount_value)')
    .eq('id', id)
    .maybeSingle();
  throwErr(error);
  return data;
}

export async function setOrderStatus(id, status) {
  const { error } = await supabase.rpc('admin_set_order_status', { p_order_id: id, p_status: status });
  throwErr(error);
}

/** Patch the small set of contact/notes fields the Sheet Orders page edits. */
export async function updateOrderContact(id, fields) {
  const { error } = await supabase.from('orders').update(fields).eq('id', id);
  throwErr(error);
}

/* ============================================================ Customers */

export async function listCustomers({ search = '', sort = 'created_at.desc', page = 1, pageSize = 20 } = {}) {
  const [col, dir] = sort.split('.');
  let q = supabase.from('profiles').select('*', { count: 'exact' });
  if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  q = q.order(col, { ascending: dir === 'asc' }).range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await q;
  throwErr(error);

  const ids = (data || []).map((p) => p.id);
  let agg = {};
  if (ids.length) {
    const { data: orders } = await supabase
      .from('orders')
      .select('user_id, total, status')
      .in('user_id', ids);
    for (const o of orders || []) {
      const a = (agg[o.user_id] ||= { orders: 0, spend: 0 });
      a.orders += 1;
      if (o.status !== 'cancelled') a.spend += Number(o.total) || 0;
    }
  }
  return {
    rows: (data || []).map((p) => ({ ...p, orders_count: agg[p.id]?.orders || 0, total_spend: agg[p.id]?.spend || 0 })),
    count: count || 0,
  };
}

export async function getCustomer(id) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  throwErr(error);
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, total, status, created_at, order_items(quantity)')
    .eq('user_id', id)
    .order('created_at', { ascending: false });
  return { profile: data, orders: orders || [] };
}

export async function setCustomerStatus(id, status) {
  const { error } = await supabase.rpc('admin_set_customer_status', { p_user_id: id, p_status: status });
  throwErr(error);
}

/* ============================================================ Inventory */

export async function listInventory({ search = '', filter = '', sort = 'stock.asc', page = 1, pageSize = 30 } = {}) {
  const [col, dir] = sort.split('.');
  let q = supabase
    .from('products')
    .select('id, name, slug, sku, stock, status, gender, price', { count: 'exact' });
  if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
  if (filter === 'low') q = q.gt('stock', 0).lte('stock', 5);
  if (filter === 'out') q = q.eq('stock', 0);
  q = q.order(col, { ascending: dir === 'asc', nullsFirst: false }).range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await q;
  throwErr(error);
  return { rows: data || [], count: count || 0 };
}

export async function updateStock(id, stock) {
  const value = stock === '' || stock === null ? 0 : Math.max(0, Math.round(Number(stock)));
  const { error } = await supabase.from('products').update({ stock: value }).eq('id', id);
  throwErr(error);
  return value;
}

/* ============================================================== Reviews */

export async function listReviews({ status = '', page = 1, pageSize = 20 } = {}) {
  let q = supabase
    .from('reviews')
    .select('*, product:products(name, slug)', { count: 'exact' });
  if (status === 'pending') q = q.eq('is_approved', false);
  if (status === 'approved') q = q.eq('is_approved', true);
  q = q.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await q;
  throwErr(error);
  return { rows: data || [], count: count || 0 };
}

export async function setReviewApproved(id, approved) {
  const { error } = await supabase.from('reviews').update({ is_approved: approved }).eq('id', id);
  throwErr(error);
}

export async function deleteReview(id) {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  throwErr(error);
}

/* ============================================================== Coupons */

export async function listCoupons() {
  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  throwErr(error);
  return data || [];
}

function cleanCoupon(input) {
  return {
    code: String(input.code || '').trim().toUpperCase(),
    description: input.description?.trim() || null,
    discount_type: input.discount_type === 'fixed' ? 'fixed' : 'percent',
    discount_value: Math.max(0, Number(input.discount_value) || 0),
    min_subtotal: Math.max(0, Number(input.min_subtotal) || 0),
    active: Boolean(input.active),
    starts_at: input.starts_at || null,
    expires_at: input.expires_at || null,
    usage_limit: input.usage_limit === '' || input.usage_limit == null ? null : Math.max(0, Math.round(Number(input.usage_limit))),
  };
}

export async function createCoupon(input) {
  const { data, error } = await supabase.from('coupons').insert(cleanCoupon(input)).select().single();
  if (error) throw friendlyAdminError(error, 'Could not create coupon');
  return data;
}

export async function updateCoupon(id, input) {
  const { data, error } = await supabase.from('coupons').update(cleanCoupon(input)).eq('id', id).select().single();
  if (error) throw friendlyAdminError(error, 'Could not save coupon');
  return data;
}

export async function deleteCoupon(id) {
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  throwErr(error);
}

/* ==================================================== Contact enquiries */

export async function getReportsDashboard({ period = 'month', dateFrom = '', dateTo = '', search = '', page = 1, pageSize = 8 } = {}) {
  const from = dateFrom || '';
  const to = dateTo || '';
  let q = supabase.from('orders').select('id, total, discount, shipping, status, created_at, customer_name, email, phone, order_items(quantity, product_id, name, product:products(name, category:categories(name), gender, fragrance_type))', { count: 'exact' });
  if (from) q = q.gte('created_at', `${from}T00:00:00`);
  if (to) q = q.lt('created_at', `${to}T23:59:59`);
  const { data: orders, error } = await q;
  throwErr(error);

  const workingRows = orders || [];
  const term = String(search || '').trim().toLowerCase();
  const rows = term
    ? workingRows.filter((o) => {
        const itemNames = (o.order_items || []).map((item) => item.name || item.product?.name || '').filter(Boolean);
        const haystack = [
          o.order_number,
          o.customer_name,
          o.email,
          o.phone,
          ...itemNames,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(term);
      })
    : workingRows;

  const total_orders = rows.length;
  const total_revenue = rows.reduce((sum, o) => sum + (o.status === 'cancelled' ? 0 : Number(o.total) || 0), 0);
  const paid_revenue = rows.filter((o) => o.status !== 'cancelled' && String(o.status).toLowerCase() !== 'pending').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const pending_orders = rows.filter((o) => String(o.status).toLowerCase() === 'pending').length;
  const processing_orders = rows.filter((o) => String(o.status).toLowerCase() === 'processing').length;
  const shipped_orders = rows.filter((o) => String(o.status).toLowerCase() === 'shipped').length;
  const delivered_orders = rows.filter((o) => String(o.status).toLowerCase() === 'delivered').length;
  const cancelled_orders = rows.filter((o) => String(o.status).toLowerCase() === 'cancelled').length;
  const total_products_sold = rows.reduce((sum, o) => sum + (o.order_items || []).reduce((n, item) => n + Number(item.quantity) || 0, 0), 0);
  const total_discounts = rows.reduce((sum, o) => sum + (Number(o.discount) || 0), 0);
  const total_shipping = rows.reduce((sum, o) => sum + (Number(o.shipping) || 0), 0);
  const average_order_value = total_orders ? total_revenue / total_orders : 0;

  const { data: profiles } = await supabase.from('profiles').select('id, created_at');
  const profileRows = profiles || [];
  const total_customers = profileRows.length;
  const new_customers = profileRows.filter((p) => p.created_at && (new Date(p.created_at).toISOString().slice(0, 10) >= from)).length;

  const best = rows.flatMap((o) => o.order_items || []).reduce((map, item) => {
    const key = item.product?.name || item.name;
    map[key] = (map[key] || { name: key, sold: 0, revenue: 0 });
    map[key].sold += Number(item.quantity) || 0;
    map[key].revenue += Number(item.unit_price || 0) * (Number(item.quantity) || 0);
    return map;
  }, {});
  const best_seller = Object.values(best).sort((a, b) => b.sold - a.sold)[0]?.name || '—';

  const lowStock = await supabase.from('products').select('stock').eq('stock', 5).maybeSingle();

  return {
    total_orders,
    total_revenue,
    paid_revenue,
    pending_orders,
    processing_orders,
    shipped_orders,
    delivered_orders,
    cancelled_orders,
    total_products_sold,
    average_order_value,
    total_discounts,
    total_shipping,
    total_customers,
    new_customers,
    low_stock: lowStock?.data?.stock || 0,
    best_seller,
  };
}

export async function listReportRows({ period = 'month', dateFrom = '', dateTo = '', search = '', page = 1, pageSize = 8 } = {}) {
  const from = dateFrom || '';
  const to = dateTo || '';
  let q = supabase.from('orders').select('id, order_number, created_at, status, total, discount, shipping, customer_name, email, phone, order_items(quantity, name, product:products(name))', { count: 'exact' });
  if (from) q = q.gte('created_at', `${from}T00:00:00`);
  if (to) q = q.lt('created_at', `${to}T23:59:59`);
  const { data, error, count } = await q;
  throwErr(error);

  const term = String(search || '').trim().toLowerCase();
  const source = data || [];
  const filtered = term
    ? source.filter((order) => {
        const itemNames = (order.order_items || []).map((item) => item.name || item.product?.name || '').filter(Boolean);
        const haystack = [
          order.order_number,
          order.customer_name,
          order.email,
          order.phone,
          ...itemNames,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(term);
      })
    : source;

  const pageStart = (page - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  const rows = pageRows.map((order) => {
    const productsSold = (order.order_items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const revenue = Number(order.total) || 0;
    const discount = Number(order.discount) || 0;
    const shipping = Number(order.shipping) || 0;
    const net = Math.max(0, revenue - discount + shipping);
    return {
      date: order.created_at ? new Date(order.created_at).toISOString().slice(0, 10) : '',
      orders: 1,
      products_sold: productsSold,
      revenue,
      discount,
      shipping,
      net_total: Math.max(0, net),
    };
  });

  return { rows, count: filtered.length };
}

export async function listEnquiries({ search = '', status = '', page = 1, pageSize = 20 } = {}) {
  let q = supabase.from('contact_enquiries').select('*', { count: 'exact' });
  if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,subject.ilike.%${search}%`);
  if (status) q = q.eq('status', status);
  q = q.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await q;
  throwErr(error);
  return { rows: data || [], count: count || 0 };
}

export async function setEnquiryStatus(id, status) {
  const { error } = await supabase.from('contact_enquiries').update({ status }).eq('id', id);
  throwErr(error);
}

export async function deleteEnquiry(id) {
  const { error } = await supabase.from('contact_enquiries').delete().eq('id', id);
  throwErr(error);
}

/* ============================================================= Settings */

export async function listAdmins() {
  const { data, error } = await supabase
    .from('profiles').select('id, full_name, email, is_admin, created_at').eq('is_admin', true);
  throwErr(error);
  return data || [];
}

export async function setAdminByEmail(email, isAdmin) {
  const { data, error } = await supabase.rpc('admin_set_admin', { p_email: email, p_is_admin: isAdmin });
  if (error) {
    if (/NO_SUCH_USER/.test(error.message)) throw new Error('No customer account found for that email — they must sign up first.');
    throw new Error(error.message);
  }
  return data;
}

export async function newsletterCount() {
  const { count, error } = await supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true });
  throwErr(error);
  return count || 0;
}
