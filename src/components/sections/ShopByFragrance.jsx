import { useMemo } from 'react';
import Section from '../layout/Section';
import SectionHeading from '../common/SectionHeading';
import Reveal from '../ui/Reveal';
import FragranceCategory from '../product/FragranceCategory';
import { useCategories, useProducts } from '../../hooks/useCatalog';
import styles from './ShopByFragrance.module.css';

/** Shop by Fragrance — category cards, sourced from Supabase when available. */
export default function ShopByFragrance() {
  const { categories } = useCategories();
  const { products } = useProducts();

  const families = useMemo(
    () => categories.map((family) => ({
      ...family,
      count: products.filter((p) => p.category === family.name).length || undefined,
    })),
    [categories, products],
  );

  return (
    <Section as="section" tone="beige" spacing="sm" aria-labelledby="fragrance-heading">
      <SectionHeading
        id="fragrance-heading"
        eyebrow="Find Your Note"
        title="Shop by Fragrance"
        intro="Four houses of scent — start where your instinct points."
        align="center"
      />
      <ul className={styles.grid}>
        {families.map((family, i) => (
          <li key={family.slug} className={styles.item}>
            <Reveal delay={Math.min(i, 3) * 60}>
              <FragranceCategory family={family} />
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
