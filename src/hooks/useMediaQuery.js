import { useEffect, useState } from 'react';

/**
 * Reactive `window.matchMedia`. Returns `true` while `query` matches and
 * updates on viewport changes / rotation. Falls back to `false` where
 * `matchMedia` is unavailable.
 *
 * @param {string} query  A media query string, e.g. `'(max-width: 47.99em)'`.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
