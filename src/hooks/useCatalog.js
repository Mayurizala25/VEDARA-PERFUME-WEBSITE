/**
 * VEDARA — catalogue hooks.
 *
 * Thin wrappers over `lib/catalog.js`. They seed state with the bundled demo
 * data so the very first render is identical to before, then (only when
 * Supabase is configured) swap in live data once it arrives. Components stay
 * synchronous and unchanged apart from where they read the list.
 */
import { useEffect, useState } from 'react';
import { products as demoProducts } from '../data/products';
import { fragranceFamilies as demoCategories } from '../data/collections';
import { getCategories, getProducts, watchCatalog } from '../lib/catalog';
import { isSupabaseConfigured } from '../lib/supabaseClient';

/** `{ products, loading, error }` — demo data first, live data when available. */
export function useProducts() {
  const [products, setProducts] = useState(demoProducts);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    const load = (silent) => {
      if (!silent) setLoading(true);
      getProducts()
        .then((rows) => { if (active && Array.isArray(rows) && rows.length) setProducts(rows); })
        .catch((err) => { if (active) setError(err); })
        .finally(() => { if (active) setLoading(false); });
    };
    load();
    const unwatch = watchCatalog(() => load(true)); // owner edits reflect live
    return () => { active = false; unwatch(); };
  }, []);

  return { products, loading, error };
}

/** `{ categories, loading }` in the `fragranceFamilies` shape. */
export function useCategories() {
  const [categories, setCategories] = useState(demoCategories);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    const load = () => getCategories()
      .then((rows) => { if (active && Array.isArray(rows) && rows.length) setCategories(rows); })
      .finally(() => { if (active) setLoading(false); });
    load();
    const unwatch = watchCatalog(load);
    return () => { active = false; unwatch(); };
  }, []);

  return { categories, loading };
}
