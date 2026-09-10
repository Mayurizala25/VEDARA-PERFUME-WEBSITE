import { useMemo } from 'react';
import Section from '../layout/Section';
import Button from '../ui/Button';
import Reveal from '../ui/Reveal';
import Figure from '../ui/Figure';
import { formatPrice } from '../../lib/format';
import { useProducts } from '../../hooks/useCatalog';
import styles from './BestSeller.module.css';

/** Best Seller — Black Cherry / Rose Gold editorial campaign for one fragrance. */
export default function BestSeller() {
  const { products } = useProducts();
  const p = useMemo(
    () =>
      products.find((x) => x.badges?.includes('bestseller'))
      || products.find((x) => x.slug === 'oudh-noir')
      || products[0],
    [products],
  );
  return (
    <Section as="section" tone="dark" spacing="sm" aria-labelledby="bestseller-heading" className={styles.section} containerClassName={styles.container}>
      <span className={styles.glow} aria-hidden="true" />
      <div className={styles.layout}>
        <Reveal className={styles.mediaCol}>
          <div className={styles.mediaFrame}>
            <Figure
              src="/images/bestseller.jpg"
              alt={`${p.name} — VEDARA best seller`}
              ratio="4 / 5"
              tone="cherry"
              className={styles.media}
              sizes="(min-width: 860px) 40vw, 90vw"
            />
            <Figure
              src="/images/note-oud.jpg"
              alt=""
              ratio="1 / 1"
              tone="cherry"
              className={styles.mediaAccent}
              sizes="180px"
            />
          </div>
        </Reveal>

        <div className={styles.info}>
          <p className={styles.eyebrow}>Rose Gold / Black Cherry</p>
          <h2 id="bestseller-heading" className={styles.name}>
            Rose Gold / Black Cherry Story
          </h2>
          <p className={styles.story}>
            A luminous composition where polished rose meets the depth of oud,
            wrapped in the warm glow of amber and modern Indian craft.
          </p>
          <p className={styles.family}>
            {p.family} · {p.fragranceType}
          </p>

          <dl className={styles.notes}>
            {[
              ['Top', p.notes.top],
              ['Heart', p.notes.heart],
              ['Base', p.notes.base],
            ].map(([label, value]) => (
              <div key={label} className={styles.note}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div className={styles.buy}>
            <p className={styles.price}>{formatPrice(p.price)} · 50 ml</p>
            <Button as="a" href={`/product/${p.slug}`} variant="light" className={styles.cta}>
              Shop {p.name}
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
