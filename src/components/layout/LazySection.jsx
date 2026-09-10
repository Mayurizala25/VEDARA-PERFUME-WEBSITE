import { Suspense, useEffect, useRef, useState } from 'react';
import styles from './LazySection.module.css';

/**
 * LazySection — defers mounting an below-the-fold homepage section until it is
 * about to enter the viewport, so the initial render (and its JS chunk, when the
 * child is `React.lazy`) stays off the critical path.
 *
 * A reserved-height placeholder holds the scroll position so nothing jumps when
 * the real content mounts. Under reduced motion / no IntersectionObserver, or
 * once seen, it just renders the children.
 *
 * @param {string} [minHeight='60vh']  Reserved space before the section mounts.
 */
export default function LazySection({ minHeight = '60vh', children }) {
  const ref = useRef(null);
  const [show, setShow] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );

  useEffect(() => {
    if (show) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShow(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [show]);

  if (show) {
    return <Suspense fallback={<div style={{ minHeight }} className={styles.pending} />}>{children}</Suspense>;
  }

  return <div ref={ref} style={{ minHeight }} className={styles.pending} aria-hidden="true" />;
}
