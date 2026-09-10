import Figure from '../ui/Figure';
import Icon from '../ui/Icon';
import styles from './FragranceCategory.module.css';

/**
 * FragranceCategory — a large visual card for "Shop by Fragrance".
 * A cropped image with the family name, a one-line description and a count
 * set over a dark gradient scrim.
 *
 * @param {object} props
 * @param {{name:string, description:string, count:number, image:string, href?:string}} props.family
 */
export default function FragranceCategory({ family }) {
  return (
    <a href={family.href ?? '/shop'} className={styles.card}>
      <Figure
        src={family.image}
        alt={`${family.name} fragrances`}
        ratio="3 / 4"
        tone="cherry"
        className={styles.media}
        sizes="(min-width: 960px) 24vw, (min-width: 560px) 45vw, 78vw"
      />
      <span className={styles.scrim} aria-hidden="true" />
      <div className={styles.body}>
        <h3 className={styles.name}>{family.name}</h3>
        <p className={styles.desc}>{family.description}</p>
        <span className={styles.meta}>
          <span>
            {typeof family.count === 'number'
              ? `${family.count} ${family.count === 1 ? 'fragrance' : 'fragrances'}`
              : 'Explore'}
          </span>
          <Icon name="arrow" size={16} className={styles.arrow} />
        </span>
      </div>
    </a>
  );
}
