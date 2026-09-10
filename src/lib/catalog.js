/**
 * VEDARA — catalogue data access.
 *
 * The single place the storefront reads product / category data from.
 * When Supabase is configured it queries the database; otherwise (or on any
 * error) it returns the bundled demo catalogue so the UI never breaks.
 *
 * Every Supabase row is normalised by `mapProductRow` into the exact shape
 * the existing components already expect, so nothing downstream changes.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { products as demoProducts } from '../data/products';
import { fragranceFamilies as demoCategories } from '../data/collections';

let warned = false;
function warnOnce(context, error) {
  if (warned) return;
  warned = true;
  console.warn(
    `[VEDARA] ${context} — falling back to the local demo catalogue.`,
    error?.message || error,
  );
}

/* ------------------------------------------------------------------ *
 * Row mapping
 * ------------------------------------------------------------------ */

/** Map a joined Supabase `products` row into the storefront product shape. */
export function mapProductRow(row) {
  const images = [...(row.product_images || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const primary = images.find((img) => img.is_primary) || images[0] || null;
  const secondary = images.find((img) => img !== primary) || null;

  const badges = [];
  if (row.new_arrival) badges.push('new');
  if (row.best_seller) badges.push('bestseller');
  if (row.original_price != null && Number(row.original_price) > Number(row.price)) {
    badges.push('sale');
  }

  const categoryName = row.category ?? row.categories?.name ?? null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    gender: row.gender ?? null,
    category: categoryName,
    fragranceType: row.fragrance_type ?? '',
    family: row.family || [categoryName, row.fragrance_type].filter(Boolean).join(' · '),
    shortDescription: row.short_description || row.description || '',
    price: Number(row.price) || 0,
    originalPrice: row.original_price != null ? Number(row.original_price) : null,
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    rating: row.rating != null ? Number(row.rating) : 5,
    reviewCount: row.review_count ?? 0,
    inStock: row.stock == null ? row.status === 'active' : Number(row.stock) > 0,
    stock: row.stock ?? null,
    notes: {
      top: row.top_notes || '',
      heart: row.heart_notes || '',
      base: row.base_notes || '',
    },
    badges,
    featured: Boolean(row.featured),
    bestSeller: Boolean(row.best_seller),
    newArrival: Boolean(row.new_arrival),
    status: row.status || 'active',
    image: primary?.url || '/images/product.jpg',
    hoverImage: secondary?.url || null,
    gallery: images.map((img) => img.url),
    tone: row.tone || 'beige',
  };
}

const PRODUCT_SELECT = '*, categories ( name, slug ), product_images ( url, alt, sort_order, is_primary )';

/* ------------------------------------------------------------------ *
 * Public queries — always resolve, never throw
 *
 * Product and category lists are fetched once per page load and shared:
 * several components mount `useProducts()` / `useCategories()` at the same
 * time, and the catalogue does not change within a session.
 * ------------------------------------------------------------------ */

let productsPromise = null;
let categoriesPromise = null;

/**
 * Drop the cached catalogue so the next `getProducts()` / `getCategories()`
 * hits the database again. Fired by the realtime subscription below (and
 * usable directly) so an owner's edit reaches open storefront tabs.
 */
export function invalidateCatalog() {
  productsPromise = null;
  categoriesPromise = null;
}

let realtimeBound = false;
/** Subscribe once to catalogue changes; `onChange` runs after invalidation. */
export function watchCatalog(onChange) {
  if (!isSupabaseConfigured || typeof onChange !== 'function') return () => {};
  const handler = () => { invalidateCatalog(); onChange(); };
  if (!realtimeBound) {
    realtimeBound = true;
    supabase
      .channel('vedara-catalog')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => window.dispatchEvent(new CustomEvent('vedara:catalog-change')))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_images' }, () => window.dispatchEvent(new CustomEvent('vedara:catalog-change')))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => window.dispatchEvent(new CustomEvent('vedara:catalog-change')))
      .subscribe();
  }
  window.addEventListener('vedara:catalog-change', handler);
  return () => window.removeEventListener('vedara:catalog-change', handler);
}

/** All active products, newest first. Falls back to the demo catalogue. */
export function getProducts() {
  if (!isSupabaseConfigured) return Promise.resolve(demoProducts);
  if (!productsPromise) {
    productsPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select(PRODUCT_SELECT)
          .eq('status', 'active')
          // `name` is a stable tiebreaker — the seed gives every row the same
          // created_at, so ordering on that alone is non-deterministic.
          .order('created_at', { ascending: false })
          .order('name', { ascending: true });
        if (error) throw error;
        const mapped = (data || []).map(mapProductRow);
        return mapped.length ? mapped : demoProducts;
      } catch (error) {
        warnOnce('Could not load products from Supabase', error);
        productsPromise = null; // allow a retry on the next mount
        return demoProducts;
      }
    })();
  }
  return productsPromise;
}

/**
 * Categories (fragrance families), ordered. Returns the demo list when
 * unconfigured so presentational sections keep their curated copy/imagery.
 */
export function getCategories() {
  if (!isSupabaseConfigured) return Promise.resolve(demoCategories);
  if (!categoriesPromise) {
    categoriesPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, slug, description, image_url, sort_order')
          .order('sort_order', { ascending: true });
        if (error) throw error;
        if (!data?.length) return demoCategories;
        return data.map((row) => ({
          slug: row.slug,
          name: row.name,
          description: row.description || '',
          image: row.image_url || `/images/cat-${row.slug}.jpg`,
          href: `/shop?family=${encodeURIComponent(row.name)}`,
        }));
      } catch (error) {
        warnOnce('Could not load categories from Supabase', error);
        categoriesPromise = null;
        return demoCategories;
      }
    })();
  }
  return categoriesPromise;
}
