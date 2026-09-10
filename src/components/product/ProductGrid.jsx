import ProductCard from './ProductCard';
import Reveal from '../ui/Reveal';
import styles from './ProductGrid.module.css';

/** ProductGrid — responsive grid of ProductCards with a gentle stagger. */
export default function ProductGrid({ products, columns = 4, carousel = false, trackRef, onQuickView, priority = false }) {
  return (
    <ul ref={trackRef} className={styles.grid} data-columns={columns} data-carousel={carousel || undefined}>
      {products.map((product, i) => (
        <li key={product.slug}>
          <Reveal delay={Math.min(i, 3) * 70}>
            {/* Only eager-load the first row; the rest lazy-load as they scroll in. */}
            <ProductCard product={product} onQuickView={onQuickView} priority={priority && i < 4} />
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
