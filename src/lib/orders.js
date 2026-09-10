/**
 * VEDARA — order service.
 *
 * `placeOrder` calls the `place_order` RPC, which validates stock, recomputes
 * every total server-side, writes the order + items, decrements stock and
 * clears the server cart — all in one transaction. If the RPC is not present
 * yet (migration 0002 not run) it falls back to a plain insert so checkout
 * still works.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getCurrentUser } from './auth';
import { getProducts } from './catalog';
import { validateCoupon } from './coupons';

const SHIPPING_FREE_THRESHOLD = 2500;
const SHIPPING_FLAT = 250;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Compute totals from authoritative product data + an optional coupon. */
export function computeTotals(items, products, coupon) {
  const priceBySlug = Object.fromEntries(products.map((p) => [p.slug, Number(p.price) || 0]));
  const subtotal = items.reduce(
    (sum, i) => sum + (priceBySlug[i.slug] ?? i.price ?? 0) * i.quantity,
    0,
  );

  let discount = 0;
  if (coupon?.valid && subtotal >= (coupon.min_subtotal || 0)) {
    discount = coupon.discount_type === 'percent'
      ? Math.round((subtotal * coupon.discount_value) / 100)
      : Math.min(coupon.discount_value, subtotal);
  }

  const shipping = subtotal - discount >= SHIPPING_FREE_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FLAT;
  return { subtotal, discount, shipping, total: subtotal - discount + shipping };
}

/** Check every line against current stock. Returns [] or a list of messages. */
export function stockProblems(items, products) {
  const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));
  const problems = [];
  for (const line of items) {
    const p = bySlug[line.slug];
    if (!p || p.status === 'archived') {
      problems.push(`${line.name} is no longer available.`);
    } else if (p.inStock === false) {
      problems.push(`${p.name} is out of stock.`);
    } else if (p.stock != null && line.quantity > p.stock) {
      problems.push(`Only ${p.stock} of ${p.name} left — reduce the quantity.`);
    }
  }
  return problems;
}

/**
 * Create an order for the current user.
 * @returns the created order ({ order_number, total, ... })
 */
export async function placeOrder({ items, email, shipping, couponCode }) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const user = getCurrentUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  if (!items?.length) throw new Error('EMPTY_CART');

  const rpcItems = items.map((i) => ({ slug: i.slug, size: i.size, quantity: i.quantity }));

  // Preferred path: the atomic RPC.
  const { data, error } = await supabase.rpc('place_order', {
    p_items: rpcItems,
    p_email: email || user.email,
    p_shipping: shipping || {},
    p_coupon: couponCode || null,
  });

  if (!error) return data;

  // RPC missing (migration 0002 not applied) → client-side fallback.
  if (error.code === 'PGRST202') {
    return placeOrderFallback({ items, email: email || user.email, shipping, couponCode, user });
  }

  // Surface friendly checkout errors thrown by the RPC.
  const msg = error.message || '';
  if (msg.includes('OUT_OF_STOCK')) throw new Error(`${msg.split(':')[1]?.trim() || 'An item'} is out of stock.`);
  if (msg.includes('PRODUCT_UNAVAILABLE')) throw new Error('An item in your bag is no longer available.');
  if (msg.includes('EMPTY_CART')) throw new Error('Your bag is empty.');
  if (msg.includes('AUTH_REQUIRED')) throw new Error('Please sign in to place your order.');
  throw error;
}

async function placeOrderFallback({ items, email, shipping, couponCode, user }) {
  const products = await getProducts();
  const problems = stockProblems(items, products);
  if (problems.length) throw new Error(problems[0]);

  const coupon = couponCode ? await validateCoupon(couponCode) : null;
  const totals = computeTotals(items, products, coupon);
  const idBySlug = Object.fromEntries(products.map((p) => [p.slug, p.id]));
  const priceBySlug = Object.fromEntries(products.map((p) => [p.slug, Number(p.price) || 0]));

  const base = {
    user_id: user.id,
    email,
    status: 'pending',
    subtotal: totals.subtotal,
    discount: totals.discount,
    shipping: totals.shipping,
    total: totals.total,
    shipping_address: shipping || {},
  };
  const rich = {
    ...base,
    customer_name: shipping?.fullName?.trim() || null,
    phone: shipping?.phone?.trim() || null,
    notes: shipping?.notes?.trim() || null,
  };

  let { data: order, error: orderErr } = await supabase.from('orders').insert(rich).select().single();
  // customer_name/phone/notes columns missing (0003 not run) → insert the base row
  if (orderErr && orderErr.code === 'PGRST204') {
    ({ data: order, error: orderErr } = await supabase.from('orders').insert(base).select().single());
  }
  if (orderErr) throw orderErr;

  const lines = items.map((i) => ({
    order_id: order.id,
    product_id: idBySlug[i.slug] || null,
    name: i.name,
    size: i.size,
    unit_price: priceBySlug[i.slug] ?? i.price ?? 0,
    quantity: i.quantity,
  }));
  const { error: itemsErr } = await supabase.from('order_items').insert(lines);
  if (itemsErr) throw itemsErr;

  await supabase.from('cart_items').delete().eq('user_id', user.id);
  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    email: order.email,
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    total: order.total,
    created_at: order.created_at,
  };
}

/** Fetch one of the current user's orders by its order number. */
export async function getOrderByNumber(orderNumber) {
  if (!isSupabaseConfigured || !orderNumber) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, product:products(name, slug, product_images(url, alt, is_primary)))')
    .eq('order_number', orderNumber)
    .maybeSingle();
  if (error) { console.warn('[VEDARA] getOrder:', error.message); return null; }
  return data;
}

/** Fetch one order by UUID. RLS still enforces that it belongs to the user. */
export async function getMyOrder(id) {
  if (!isSupabaseConfigured || !getCurrentUser() || !id || !UUID_RE.test(id)) throw new Error('ORDER_NOT_FOUND');
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*, product:products(name, slug, product_images(url, alt, is_primary))')
    .eq('order_id', id)
    .order('created_at', { ascending: true });
  if (itemsError) throw itemsError;
  return { ...order, order_items: items || [] };
}

/** All of the current user's orders, newest first. RLS scopes this query. */
export async function getMyOrders({ status = '', search = '' } = {}) {
  if (!isSupabaseConfigured || !getCurrentUser()) return [];
  let queryBuilder = supabase
    .from('orders')
    .select('id, order_number, status, email, customer_name, subtotal, discount, shipping, total, shipping_address, created_at, order_items(id, name, size, quantity, unit_price, product:products(name, slug, product_images(url, alt, is_primary)))');
  if (status) queryBuilder = queryBuilder.eq('status', status);
  const { data, error } = await queryBuilder.order('created_at', { ascending: false });
  if (error) throw error;
  const query = search.trim().toLowerCase();
  return (data || []).filter((order) => {
    if (status && order.status !== status) return false;
    if (!query) return true;
    return [order.order_number, ...(order.order_items || []).map((item) => item.name)]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });
}

/** Cancel only orders still awaiting fulfilment. The RPC re-checks ownership. */
export async function cancelMyOrder(id) {
  if (!isSupabaseConfigured || !getCurrentUser()) throw new Error('AUTH_REQUIRED');
  const { error } = await supabase.rpc('customer_cancel_order', { p_order_id: id });
  if (error) throw error;
}
