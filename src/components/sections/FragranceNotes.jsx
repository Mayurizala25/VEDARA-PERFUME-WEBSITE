import { useRef } from 'react';
import Section from '../layout/Section';
import SectionHeading from '../common/SectionHeading';
import Icon from '../ui/Icon';
import Figure from '../ui/Figure';
import { fragranceNotes } from '../../data/collections';
import styles from './FragranceNotes.module.css';

/**
 * Fragrance Notes — a horizontal editorial slider of the raw materials the
 * house builds on. Scent descriptors only — no sourcing or product claims.
 */
export default function FragranceNotes() {
  const track = useRef(null);

  const scrollBy = (direction) => {
    const card = track.current?.querySelector('li');
    if (card) {
      track.current.scrollBy({ left: direction * (card.offsetWidth + 16), behavior: 'smooth' });
    }
  };

  return (
    <Section as="section" tone="beige" spacing="sm" aria-labelledby="notes-heading">
      <div className={styles.head}>
        <SectionHeading
          id="notes-heading"
          eyebrow="The Palette"
          title="Fragrance Notes"
          intro="Six materials we return to — from the attar tradition and beyond."
          flush
        />
        <div className={styles.controls}>
          <button type="button" className={styles.control} aria-label="Previous notes" onClick={() => scrollBy(-1)}>
            <Icon name="arrow" size={18} className={styles.previous} />
          </button>
          <button type="button" className={styles.control} aria-label="Next notes" onClick={() => scrollBy(1)}>
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </div>

      <ul className={styles.track} ref={track} tabIndex={0} aria-label="Fragrance notes">
        {fragranceNotes.map((item, i) => (
          <li key={item.slug} className={styles.slide}>
            <figure className={styles.note} tabIndex={0}>
              <Figure
                src={item.image}
                alt={`${item.name} — fragrance note`}
                ratio="3 / 4"
                tone="cherry"
                className={styles.media}
                sizes="(min-width: 900px) 24vw, (min-width: 620px) 40vw, 66vw"
              />
              <span className={styles.scrim} aria-hidden="true" />
              <figcaption className={styles.caption}>
                <span className={styles.idx} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={styles.name}>{item.name}</span>
                <span className={styles.desc}>{item.note}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  );
}
