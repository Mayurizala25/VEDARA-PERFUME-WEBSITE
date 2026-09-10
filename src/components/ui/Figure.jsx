import styles from './Figure.module.css';

/**
 * Figure — a cropped image frame with a consistent aspect ratio and an
 * optional hover zoom. Images are campaign placeholders under `public/images/`;
 * swap the `src` for real photography without touching layout.
 *
 * @param {object} props
 * @param {string} props.src
 * @param {string} props.alt          Empty string if purely decorative.
 * @param {string} [props.ratio='4 / 5']
 * @param {boolean} [props.zoom=true]
 * @param {boolean} [props.priority=false]  Eager-load above-the-fold images.
 * @param {'ivory'|'beige'|'cherry'|'dark'} [props.tone='beige']  Placeholder tint while loading.
 * @param {string} [props.className]
 * @param {string} [props.sizes]
 */
export default function Figure({
  src,
  alt,
  ratio = '4 / 5',
  zoom = true,
  priority = false,
  tone = 'beige',
  className = '',
  sizes,
}) {
  const classes = [styles.figure, styles[tone], zoom && styles.zoom, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={{ aspectRatio: ratio }}>
      <img
        className={styles.img}
        src={src}
        alt={alt}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...(priority ? { fetchpriority: 'high' } : {})}
      />
    </div>
  );
}
