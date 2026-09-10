import { useCallback, useEffect, useRef, useState } from 'react';

/** Run an async fn, exposing { data, loading, error, reload }. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(() => fnRef.current())
      .then((data) => { if (alive) setState({ data, loading: false, error: null }); })
      .catch((error) => { if (alive) setState({ data: null, loading: false, error }); });
    return () => { alive = false; };
  }, []);

  useEffect(run, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: run };
}

/** Debounce a fast-changing value. */
export function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** Warn before leaving/refreshing when there are unsaved changes. */
export function useUnsavedWarning(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}

/** Standard list-page state: search + filters + sort + pagination. */
export function useListParams(initial = {}) {
  const [params, setParams] = useState({ search: '', status: '', gender: '', filter: '', sort: '', page: 1, ...initial });
  const debouncedSearch = useDebounced(params.search, 350);
  const set = useCallback((patch) => {
    setParams((p) => ({ ...p, ...patch, page: 'page' in patch ? patch.page : 1 }));
  }, []);
  return { params: { ...params, search: debouncedSearch }, raw: params, set };
}
