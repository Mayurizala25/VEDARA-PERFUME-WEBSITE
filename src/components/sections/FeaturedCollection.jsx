import { useMemo, useRef } from 'react';
import Section from '../layout/Section';
import SectionHeading from '../common/SectionHeading';
import ProductGrid from '../product/ProductGrid';
import Icon from '../ui/Icon';
import { useProducts } from '../../hooks/useCatalog';
import styles from './FeaturedCollection.module.css';

/** Featured Collection — the highlighted fragrances, as an editorial carousel. */
export default function FeaturedCollection() {
  const track = useRef(null);
  const { products } = useProducts();
  const featured = useMemo(() => {
    const picks = products.filter((p) => p.featured);
    return (picks.length ? picks : products).slice(0, 4);
  }, [products]);

  const scrollBy = (direction) => {
    const card = track.current?.querySelector('li');
    if (card) {
      track.current.scrollBy({ left: direction * (card.offsetWidth + 24), behavior: 'smooth' });
    }
  };

  return (
    <Section as="section" tone="default" spacing="sm" aria-labelledby="featured-heading" containerClassName={styles.container} id="collection">
      <div className={styles.head}>
        <SectionHeading
          id="featured-heading"
          eyebrow="The Collection"
          title="Featured Fragrances"
          intro="A concise edit of the fragrances we return to most — across oud, floral and amber."
          flush
        />
        <div className={styles.headSide}>
          <a href="/shop" className={styles.viewAll}>
            View all<span aria-hidden="true">&nbsp;&rarr;</span>
          </a>
          <div className={styles.controls}>
            <button type="button" className={styles.control} aria-label="Previous fragrances" onClick={() => scrollBy(-1)}>
              <Icon name="arrow" size={18} className={styles.previous} />
            </button>
            <button type="button" className={styles.control} aria-label="Next fragrances" onClick={() => scrollBy(1)}>
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.trackWrap}>
        <ProductGrid products={featured} columns={4} carousel trackRef={track} priority />
      </div>
    </Section>
  );
}
