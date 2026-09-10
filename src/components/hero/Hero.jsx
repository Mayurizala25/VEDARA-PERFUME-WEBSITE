import { useCallback, useEffect, useRef, useState } from 'react';
import Container from '../layout/Container';
import Button from '../ui/Button';
import styles from './Hero.module.css';

/**
 * Hero — cinematic full-screen VEDARA fragrance campaign.
 * Three editorial slides crossfade behind an oversized Cormorant headline.
 * The active slide runs a slow Ken-Burns push; the whole stage drifts on
 * scroll (parallax). Slide navigation: dots + arrows + an auto-advance
 * progress bar. All motion collapses under `prefers-reduced-motion`.
 */
const SLIDES = [
  {
    id: 'essence',
    image: '/images/lifestyle.jpg',
    align: 'left',
    eyebrow: 'VEDARA Fragrance House',
    title: ['Wear Your', 'Essence.'],
    lede: 'Discover fragrances crafted to leave a lasting impression.',
    primary: { label: 'Shop Collection', href: '/shop' },
    secondary: { label: 'Discover VEDARA', href: '/about' },
  },
  {
    id: 'attar',
    image: '/images/product-amber-veil.jpg',
    align: 'left',
    eyebrow: 'The Collection',
    title: ['The Attar,', 'Reimagined.'],
    lede: 'Rose, jasmine, oud and sandalwood — composed with a modern, restrained hand.',
    primary: { label: 'Explore the Collection', href: '/shop' },
    secondary: { label: 'Our Story', href: '/about' },
  },
  {
    id: 'oudh-noir',
    image: '/images/slider3.jpg',
    align: 'left',
    eyebrow: 'House Favourite',
    title: ['Oudh', 'Noir.'],
    lede: 'Saffron and rose over deep oud and amber — the composition we are asked about most.',
    primary: { label: 'Shop Oudh Noir', href: '/product/oudh-noir' },
    secondary: { label: 'View all fragrances', href: '/shop' },
  },
];

const DURATION = 5600;
/* After a manual interaction (tap / swipe) autoplay rests this long, then resumes. */
const RESUME_DELAY = 9000;
/* Minimum horizontal travel for a swipe to count as a slide change. */
const SWIPE_THRESHOLD = 44;

export default function Hero() {
  const stageRef = useRef(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const go = useCallback((next) => {
    setActive((current) => (next + SLIDES.length) % SLIDES.length);
  }, []);

  const step = useCallback((dir) => {
    setActive((current) => (current + dir + SLIDES.length) % SLIDES.length);
  }, []);

  // Pause autoplay when the visitor takes over, then hand it back after a rest.
  const resumeTimer = useRef(0);
  const nudge = useCallback(() => {
    setPaused(true);
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setPaused(false), RESUME_DELAY);
  }, []);
  useEffect(() => () => window.clearTimeout(resumeTimer.current), []);

  // Swipe left / right on touch devices.
  const touchStart = useRef(null);
  const onTouchStart = (event) => {
    const t = event.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (event) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      step(dx < 0 ? 1 : -1);
    }
    nudge();
  };

  // Auto-advance.
  useEffect(() => {
    if (paused || reduced) return undefined;
    const id = window.setTimeout(() => go(active + 1), DURATION);
    return () => window.clearTimeout(id);
  }, [active, paused, reduced, go]);

  // Scroll parallax on the image stage — desktop only; phones get a static stage
  // so scrolling stays smooth and the GPU isn't driving a full-bleed layer.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || reduced) return undefined;
    if (!window.matchMedia('(min-width: 60em)').matches) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = Math.max(0, window.scrollY);
      if (y < window.innerHeight) el.style.setProperty('--parallax', `${y * 0.16}px`);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const scrollToNext = (event) => {
    event.preventDefault();
    window.scrollTo({
      top: Math.round(window.innerHeight * 0.92),
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  const slide = SLIDES[active];

  return (
    <section
      className={styles.hero}
      aria-labelledby="hero-heading"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className={styles.stage} ref={stageRef} aria-hidden="true">
        {SLIDES.map((item, index) => (
          <div
            key={item.id}
            className={styles.slideImage}
            data-active={index === active || undefined}
            style={{ backgroundImage: `url(${item.image})` }}
          />
        ))}
        <span className={styles.wash} />
        <span className={styles.scrim} data-align={slide.align} />
        <span className={styles.grain} />
      </div>

      <Container className={styles.inner}>
        <div
          className={styles.content}
          data-align={slide.align}
          key={slide.id}
          role="group"
          aria-roledescription="slide"
          aria-label={`${active + 1} of ${SLIDES.length}`}
        >
          <p className={styles.eyebrow}>{slide.eyebrow}</p>
          <h1 id="hero-heading" className={styles.title}>
            {slide.title.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <p className={styles.lede}>{slide.lede}</p>
          <div className={styles.actions}>
            <Button as="a" href={slide.primary.href} variant="light" size="lg">
              {slide.primary.label}
            </Button>
            <a href={slide.secondary.href} className={styles.secondary}>
              {slide.secondary.label}
              <span className={styles.secondaryArrow} aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Previous slide"
            onClick={() => { step(-1); nudge(); }}
          >
            <span aria-hidden="true">&larr;</span>
          </button>

          <div className={styles.dots} role="tablist" aria-label="Choose slide">
            {SLIDES.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={styles.dot}
                data-active={index === active || undefined}
                role="tab"
                aria-selected={index === active}
                aria-label={`Slide ${index + 1}: ${item.title.join(' ')}`}
                onClick={() => { setActive(index); nudge(); }}
              >
                <span
                  className={styles.dotFill}
                  data-run={index === active && !paused && !reduced || undefined}
                  style={{ animationDuration: `${DURATION}ms` }}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.arrow}
            aria-label="Next slide"
            onClick={() => { step(1); nudge(); }}
          >
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </Container>

      <a href="#collection" className={styles.explore} onClick={scrollToNext}>
        Explore the collection
        <span className={styles.exploreArrow} aria-hidden="true">&darr;</span>
      </a>
    </section>
  );
}
