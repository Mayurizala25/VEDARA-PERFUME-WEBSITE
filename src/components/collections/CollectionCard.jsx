import Figure from '../ui/Figure';
import Icon from '../ui/Icon';
import styles from './Collections.module.css';

/**
 * CollectionCard — an editorial card linking to `/collections/:slug`.
 * A cropped image under a dark scrim with the collection name, one mood
 * line and a live product count.
 *
 * @param {object} props
 * @param {import('../../lib/collections').Collection} props.collection
 * @param {'lg'|'md'} [props.size='md']
 * @param {boolean} [props.priority=false]
 */
export default function CollectionCard({ collection, size = 'md', priority = false }) {
  const { title, tagline, count, image, href, kind } = collection;
  return (
    <a href={href} className={styles.card} data-size={size}>
      <Figure
        src={image}
        alt={`${title} collection`}
        ratio={size === 'lg' ? '4 / 5' : '3 / 4'}
        tone="cherry"
        className={styles.cardMedia}
        priority={priority}
        sizes={
          size === 'lg'
            ? '(min-width: 960px) 33vw, 90vw'
            : '(min-width: 960px) 25vw, (min-width: 600px) 45vw, 82vw'
        }
      />
      <span className={styles.cardScrim} aria-hidden="true" />
      <span className={styles.cardBody}>
        <span className={styles.cardKind}>
          {kind === 'audience' ? 'Shop by' : 'Scent family'}
        </span>
        <span className={styles.cardTitle}>{title}</span>
        {tagline ? <span className={styles.cardTagline}>{tagline}</span> : null}
        <span className={styles.cardMeta}>
          <span>
            {count > 0
              ? `${count} ${count === 1 ? 'fragrance' : 'fragrances'}`
              : 'Coming soon'}
          </span>
          <Icon name="arrow" size={16} className={styles.cardArrow} />
        </span>
      </span>
    </a>
  );
}
