import Icon from './Icon';
import styles from './Rating.module.css';

/** Rating — five gold star glyphs, `value` of them filled. */
export default function Rating({ value = 5, className = '' }) {
  return (
    <span
      className={[styles.rating, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={`${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={n <= value ? styles.on : styles.off}
          aria-hidden="true"
        >
          <Icon name="star" size={15} strokeWidth={1} />
        </span>
      ))}
    </span>
  );
}
