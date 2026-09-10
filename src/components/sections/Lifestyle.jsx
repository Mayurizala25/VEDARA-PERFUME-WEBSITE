import { useEffect, useRef } from 'react';
import Reveal from '../ui/Reveal';
import styles from './Lifestyle.module.css';

/** Lifestyle — cinematic full-width signature statement. */
export default function Lifestyle() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      el.style.setProperty('--shift', `${(-progress * 40).toFixed(1)}px`);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className={styles.section} ref={ref} aria-labelledby="lifestyle-heading">
      <div className={styles.media} aria-hidden="true">
        <img
          className={styles.image}
          src="/images/lifestyle.jpg"
          alt=""
          width="2000"
          height="1100"
          loading="lazy"
          decoding="async"
        />
      </div>
      <span className={styles.scrim} aria-hidden="true" />

      <Reveal className={styles.overlay}>
        <p className={styles.eyebrow}>The VEDARA Campaign</p>
        <h2 id="lifestyle-heading" className={styles.title}>
          <span>Your Scent.</span>
          <span className={styles.rule} aria-hidden="true" />
          <span>Your Signature.</span>
        </h2>
        <a href="/shop" className={styles.link}>
          Discover VEDARA
          <span aria-hidden="true">&nbsp;&rarr;</span>
        </a>
      </Reveal>
    </section>
  );
}
