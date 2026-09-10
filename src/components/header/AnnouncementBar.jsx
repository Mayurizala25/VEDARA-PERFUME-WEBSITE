import { useEffect, useState } from 'react';
import styles from './AnnouncementBar.module.css';

const MESSAGES = [
  'Free Shipping',
  'Complimentary Samples',
  'Discover VEDARA',
];

/** AnnouncementBar — slim strip above the navigation with rotating messages. */
export default function AnnouncementBar() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(
      () => setIndex((current) => (current + 1) % MESSAGES.length),
      3600,
    );
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div
      className={styles.bar}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Full sequence, always visible on wider screens. */}
      <p className={styles.full} aria-hidden="true">
        {MESSAGES.map((message, i) => (
          <span key={message}>
            {message}
            {i < MESSAGES.length - 1 ? <i className={styles.dot} aria-hidden="true" /> : null}
          </span>
        ))}
      </p>

      {/* Rotating single message for narrow screens + screen readers. */}
      <p className={styles.rotator} key={index} role="status">
        {MESSAGES[index]}
      </p>
    </div>
  );
}
