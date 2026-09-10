/**
 * VEDARA — collections hooks.
 *
 * Thin reactive wrappers over `lib/collections.js`. They expose loading /
 * error / empty state so the Collections views can render every UX state.
 */
import { useEffect, useState } from 'react';
import { getCollections } from '../lib/collections';

/** `{ audience, families, all, featured, loading, error }`. */
export function useCollections() {
  const [state, setState] = useState({
    audience: [],
    families: [],
    all: [],
    featured: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    getCollections()
      .then((data) => {
        if (active) setState({ ...data, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState((s) => ({ ...s, loading: false, error }));
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
