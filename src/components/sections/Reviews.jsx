import { useEffect, useMemo, useState } from 'react';
import Section from '../layout/Section';
import SectionHeading from '../common/SectionHeading';
import Rating from '../ui/Rating';
import Icon from '../ui/Icon';
import { reviews as curatedReviews } from '../../data/reviews';
import { getRecentReviews } from '../../lib/reviews';
import styles from './Reviews.module.css';

/**
 * Customer Reviews — a single-quote testimonial carousel. Shows real approved
 * reviews from Supabase when there are any; otherwise curated brand copy.
 */
export default function Reviews() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [live, setLive] = useState(null);

  useEffect(() => {
    let alive = true;
    getRecentReviews().then((rows) => { if (alive && rows.length) setLive(rows); });
    return () => { alive = false; };
  }, []);

  const reviews = live && live.length ? live : curatedReviews;
  const isLive = Boolean(live && live.length);
  const go = (next) => setActive((next + reviews.length) % reviews.length);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setTimeout(() => go(active + 1), 6000);
    return () => window.clearTimeout(id);
  }, [active, paused, reviews.length]);

  const review = reviews[active % reviews.length];
  const eyebrow = useMemo(() => (isLive ? 'From the VEDARA community' : 'What people are saying'), [isLive]);

  return (
    <Section as="section" tone="beige" spacing="sm" aria-labelledby="reviews-heading" containerClassName={styles.container}>
      <SectionHeading
        id="reviews-heading"
        eyebrow={eyebrow}
        title="What Our Customers Say"
        align="center"
        flush
      />

      <div
        className={styles.stage}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <button
          type="button"
          className={`${styles.arrow} ${styles.prev}`}
          aria-label="Previous review"
          onClick={() => go(active - 1)}
        >
          <Icon name="arrow" size={18} className={styles.flip} />
        </button>

        <figure className={styles.card} key={review.id} aria-live="polite">
          <span className={styles.mark} aria-hidden="true">&ldquo;</span>
          <Rating value={review.rating} className={styles.rating} />
          <blockquote className={styles.quote}>{review.quote}</blockquote>
          <figcaption className={styles.by}>
            <span className={styles.name}>{review.name}</span>
            <span className={styles.detail}>{[review.location, review.product].filter(Boolean).join(' · ')}</span>
          </figcaption>
        </figure>

        <button
          type="button"
          className={`${styles.arrow} ${styles.next}`}
          aria-label="Next review"
          onClick={() => go(active + 1)}
        >
          <Icon name="arrow" size={18} />
        </button>
      </div>

      <div className={styles.dots} role="tablist" aria-label="Reviews">
        {reviews.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={styles.dot}
            data-active={index === active % reviews.length || undefined}
            role="tab"
            aria-selected={index === active % reviews.length}
            aria-label={`Review ${index + 1}`}
            onClick={() => setActive(index)}
          />
        ))}
      </div>
    </Section>
  );
}
