/**
 * VEDARA — cart + wishlist service.
 *
 * localStorage is always the working copy so the UI is instant and guests
 * keep their bag across refreshes. When a user is signed in, every mutation
 * is mirrored to Supabase (`cart_items` / `wishlist`), and on sign-in the
 * guest bag is merged up to the server, which then becomes the source of
 * truth. Sign-out clears the local mirror (the server keeps the user's data).
 *
 * Reads (`readCart`, `cartCount`, `readWishlist`) stay synchronous.
 * Components listen for `vedara:cart-change` / `vedara:wishlist-change`.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getCurrentUser } from './auth';

const CART_KEY = 'vedara-cart';
const WISHLIST_KEY = 'vedara-wishlist';
const PENDING_KEY = 'vedara-pending-purchase';
const COUPON_KEY = 'vedara-coupon';
const CHECKOUT_DETAILS_KEY = 'vedara-checkout-details';

/* ---- localStorage helpers ------------------------------------------------ */

function read(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / private mode */ }
}

const emitCart = () => window.dispatchEvent(new CustomEvent('vedara:cart-change'));
const emitWishlist = () => window.dispatchEvent(new CustomEvent('vedara:wishlist-change'));

function logSync(context, error) {
  if (error) console.warn(`[VEDARA] cart/wishlist sync — ${context}:`, error?.message || error);
}

/* ---- Cart (local) ------------------------------------------------------- */

export function readCart() {
  return read(CART_KEY, []);
}

export function cartCount() {
  return readCart().reduce((total, item) => total + item.quantity, 0);
}

export function cartSubtotal() {
  return readCart().reduce((total, item) => total + item.price * item.quantity, 0);
}

function normaliseItem(product, size, quantity) {
  return {
    slug: product.slug,
    productId: product.id || null,
    name: product.name,
    image: product.image,
    price: Number(product.price) || 0,
    size: size || product.sizes?.[0] || '50ml',
    quantity,
  };
}

export function addCartItem(product, quantity = 1, size = '50ml') {
  const cart = readCart();
  const key = size || product.sizes?.[0] || '50ml';
  const existing = cart.find((item) => item.slug === product.slug && item.size === key);
  if (existing) existing.quantity += quantity;
  else cart.push(normaliseItem(product, key, quantity));
  write(CART_KEY, cart);
  emitCart();
  const item = cart.find((i) => i.slug === product.slug && i.size === key);
  pushCartItem(item);
}

export function updateCartItem(slug, size, quantity) {
  let target = null;
  const cart = readCart()
    .map((item) => {
      if (item.slug === slug && item.size === size) { target = { ...item, quantity }; return target; }
      return item;
    })
    .filter((item) => item.quantity > 0);
  write(CART_KEY, cart);
  emitCart();
  if (quantity <= 0) removeCartRemote(target || { slug, size });
  else if (target) pushCartItem(target);
}

export function removeCartItem(slug, size) {
  const removed = readCart().find((item) => item.slug === slug && item.size === size);
  write(CART_KEY, readCart().filter((item) => !(item.slug === slug && item.size === size)));
  emitCart();
  removeCartRemote(removed || { slug, size });
}

export function clearCart({ remote = true } = {}) {
  write(CART_KEY, []);
  emitCart();
  if (remote && isSupabaseConfigured && getCurrentUser()) {
    supabase.from('cart_items').delete().eq('user_id', getCurrentUser().id)
      .then(({ error }) => logSync('clear', error));
  }
}

/* ---- Wishlist (local) ------------------------------------------------- */

export function readWishlist() {
  return read(WISHLIST_KEY, []);
}

export function isWishlisted(slug) {
  return readWishlist().includes(slug);
}

/** Accepts a product object (preferred) or a bare slug string. */
export function toggleWishlist(productOrSlug) {
  const slug = typeof productOrSlug === 'string' ? productOrSlug : productOrSlug.slug;
  const productId = typeof productOrSlug === 'string' ? null : (productOrSlug.id || null);
  const current = readWishlist();
  const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
  write(WISHLIST_KEY, next);
  emitWishlist();
  const added = next.includes(slug);
  pushWishlist(slug, productId, added);
  return added;
}

/* ---- Applied coupon (survives the cart → checkout navigation) ---------- */

export function readCoupon() {
  return read(COUPON_KEY, null);
}
export function writeCoupon(coupon) {
  if (coupon) write(COUPON_KEY, coupon);
  else { try { window.localStorage.removeItem(COUPON_KEY); } catch { /* noop */ } }
}

/* ---- Persistent checkout shipping details & saved addresses ------------ */

export function readCheckoutDetails() {
  return read(CHECKOUT_DETAILS_KEY, { addresses: [], selectedAddressId: '', email: '' });
}

export function writeCheckoutDetails(details) {
  if (!details) { try { window.localStorage.removeItem(CHECKOUT_DETAILS_KEY); } catch { /* noop */ } return; }
  write(CHECKOUT_DETAILS_KEY, details);
}

/* ---- Pending "Buy now" selection ------------------------------------- *
 * Held in localStorage so it survives the sign-in round trip even when that
 * round trip includes an email-confirmation link opened in a fresh tab.
 * Always cleared once consumed (or overwritten by the next "Buy now").
 */
export function setPendingPurchase(entry) {
  try { window.localStorage.setItem(PENDING_KEY, JSON.stringify({ ...entry, at: Date.now() })); } catch { /* noop */ }
}
export function readPendingPurchase() {
  try {
    const value = window.localStorage.getItem(PENDING_KEY);
    if (!value) return null;
    const entry = JSON.parse(value);
    // Ignore anything older than 7 days.
    if (entry.at && Date.now() - entry.at > 7 * 864e5) { clearPendingPurchase(); return null; }
    return entry;
  } catch { return null; }
}
export function clearPendingPurchase() {
  try { window.localStorage.removeItem(PENDING_KEY); } catch { /* noop */ }
}

/** Move a pending "Buy now" selection into the cart, if one exists. */
export function flushPendingPurchase() {
  const entry = readPendingPurchase();
  clearPendingPurchase();
  if (!entry || !entry.slug || entry.price == null) return false;
  addCartItem(
    { slug: entry.slug, id: entry.id || null, name: entry.name, image: entry.image, price: entry.price },
    entry.quantity || 1,
    entry.size || '50ml',
  );
  return true;
}

/* ====================================================================== *
 * Supabase mirroring
 * ====================================================================== */

function pushCartItem(item) {
  const user = getCurrentUser();
  if (!isSupabaseConfigured || !user || !item?.productId) return;
  supabase.from('cart_items')
    .upsert(
      { user_id: user.id, product_id: item.productId, size: item.size, quantity: item.quantity },
      { onConflict: 'user_id,product_id,size' },
    )
    .then(({ error }) => logSync('upsert item', error));
}

function removeCartRemote(item) {
  const user = getCurrentUser();
  if (!isSupabaseConfigured || !user) return;
  let q = supabase.from('cart_items').delete().eq('user_id', user.id);
  if (item?.productId) q = q.eq('product_id', item.productId);
  if (item?.size) q = q.eq('size', item.size);
  q.then(({ error }) => logSync('delete item', error));
}

function pushWishlist(slug, productId, added) {
  const user = getCurrentUser();
  if (!isSupabaseConfigured || !user) return;
  const run = async () => {
    let id = productId;
    if (!id) {
      const { data } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
      id = data?.id;
    }
    if (!id) return;
    if (added) {
      const { error } = await supabase.from('wishlist')
        .upsert({ user_id: user.id, product_id: id }, { onConflict: 'user_id,product_id' });
      logSync('wishlist add', error);
    } else {
      const { error } = await supabase.from('wishlist')
        .delete().eq('user_id', user.id).eq('product_id', id);
      logSync('wishlist remove', error);
    }
  };
  run();
}

function toLocalCartRow(row) {
  const p = row.product || {};
  const images = [...(p.product_images || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const primary = images.find((i) => i.is_primary) || images[0];
  return {
    slug: p.slug,
    productId: p.id,
    name: p.name,
    image: primary?.url || '/images/product.jpg',
    price: Number(p.price) || 0,
    size: row.size || '50ml',
    quantity: row.quantity || 1,
  };
}

/** Pull the server cart + wishlist and make them the local truth. */
async function pullFromServer() {
  const user = getCurrentUser();
  if (!isSupabaseConfigured || !user) return;

  const [{ data: cartRows, error: cartErr }, { data: wishRows, error: wishErr }] = await Promise.all([
    supabase.from('cart_items')
      .select('quantity, size, product:products(id, slug, name, price, product_images(url, is_primary, sort_order))')
      .eq('user_id', user.id),
    supabase.from('wishlist')
      .select('product:products(slug)')
      .eq('user_id', user.id),
  ]);
  logSync('pull cart', cartErr);
  logSync('pull wishlist', wishErr);

  if (!cartErr && Array.isArray(cartRows)) {
    write(CART_KEY, cartRows.filter((r) => r.product).map(toLocalCartRow));
    emitCart();
  }
  if (!wishErr && Array.isArray(wishRows)) {
    write(WISHLIST_KEY, wishRows.map((r) => r.product?.slug).filter(Boolean));
    emitWishlist();
  }
}

/** On sign-in: push the guest bag/wishlist up, then pull the merged result. */
async function mergeToServer() {
  const user = getCurrentUser();
  if (!isSupabaseConfigured || !user) return;

  const localCart = readCart();
  const localWish = readWishlist();

  // resolve slugs → ids for anything missing an id
  const slugs = [
    ...new Set([...localCart.map((i) => i.slug), ...localWish].filter(Boolean)),
  ];
  let idBySlug = {};
  if (slugs.length) {
    const { data } = await supabase.from('products').select('id, slug').in('slug', slugs);
    idBySlug = Object.fromEntries((data || []).map((p) => [p.slug, p.id]));
  }

  const cartRows = localCart
    .map((i) => ({
      user_id: user.id,
      product_id: i.productId || idBySlug[i.slug],
      size: i.size || '50ml',
      quantity: i.quantity,
    }))
    .filter((r) => r.product_id);
  if (cartRows.length) {
    const { error } = await supabase.from('cart_items')
      .upsert(cartRows, { onConflict: 'user_id,product_id,size' });
    logSync('merge cart', error);
  }

  const wishRows = localWish
    .map((slug) => ({ user_id: user.id, product_id: idBySlug[slug] }))
    .filter((r) => r.product_id);
  if (wishRows.length) {
    const { error } = await supabase.from('wishlist')
      .upsert(wishRows, { onConflict: 'user_id,product_id' });
    logSync('merge wishlist', error);
  }

  await pullFromServer();
}

/* ---- boot: react to auth changes -------------------------------------- */

if (typeof window !== 'undefined') {
  window.addEventListener('vedara:auth-change', (event) => {
    const user = event.detail?.user;
    const kind = event.detail?.event;
    if (!user) {
      // signed out — drop the local mirror (server keeps the account's data)
      write(CART_KEY, []);
      write(WISHLIST_KEY, []);
      writeCoupon(null);
      emitCart();
      emitWishlist();
      return;
    }
    if (kind === 'SIGNED_IN') mergeToServer();
    else pullFromServer();
  });
}
