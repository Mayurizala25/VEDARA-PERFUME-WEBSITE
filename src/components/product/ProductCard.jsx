import { useState } from 'react';
import Figure from '../ui/Figure';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import Rating from '../ui/Rating';
import { formatPrice } from '../../lib/format';
import styles from './ProductCard.module.css';
import { addCartItem } from '../../lib/commerce';
import { useWishlist } from '../../hooks/useCommerce';

const BADGE_LABEL = { new: 'New', sale: 'Offer', bestseller: 'Best Seller' };

/**
 * ProductCard — editorial display card (homepage rails + related products).
 * Wishlist toggle, add-to-cart and an optional Quick View. Cart / wishlist
 * state is persisted via `commerce.js`.
 */
export default function ProductCard({ product, onQuickView, priority = false }) {
  const wishlist = useWishlist();
  const wished = wishlist.has(product.slug);
  const [added, setAdded] = useState(false);
  const badge = product.badges[0];
  const onSale = Boolean(product.originalPrice);
  const soldOut = product.inStock === false;
  const addToCart = () => {
    if (soldOut) return;
    setAdded(true);
    addCartItem(product);
    window.dispatchEvent(new CustomEvent('vedara:toast', { detail: { message: 'Added to your collection.' } }));
    window.setTimeout(() => setAdded(false), 2200);
  };

  const toggleWishlist = () => {
    const next = wishlist.toggle(product);
    if (next) {
      window.dispatchEvent(new CustomEvent('vedara:toast', { detail: { message: 'Saved to your wishlist.' } }));
    }
  };

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <Figure
          src={product.image}
          alt={`${product.name} eau de parfum`}
          ratio="4 / 5"
          className={styles.image}
          priority={priority}
          sizes="(min-width: 960px) 22vw, (min-width: 600px) 45vw, 90vw"
        />
        {badge ? <span className={styles.badge}>{BADGE_LABEL[badge]}</span> : null}
        {onQuickView ? (
          <button type="button" className={styles.quickView} onClick={() => onQuickView(product)}>
            Quick view
          </button>
        ) : null}
        <button
          type="button"
          className={styles.wish}
          aria-pressed={wished}
          aria-label={
            wished
              ? `Remove ${product.name} from wishlist`
              : `Add ${product.name} to wishlist`
          }
          onClick={toggleWishlist}
          data-active={wished || undefined}
        >
          <Icon name="heart" size={18} />
        </button>
      </div>

      <div className={styles.body}>
        <p className={styles.family}>{product.family}</p>
        <h3 className={styles.name}>
          <a href={`/product/${product.slug}`}>{product.name}</a>
        </h3>
        <p className={styles.price}>
          <span className={onSale ? styles.now : undefined}>
            {formatPrice(product.price)}
          </span>
          {onSale ? (
            <span className={styles.was}>{formatPrice(product.originalPrice)}</span>
          ) : null}
        </p>
        <Rating value={product.rating || 5} className={styles.rating} />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={styles.add}
          onClick={addToCart}
          disabled={soldOut}
        >
          {soldOut ? 'Sold out' : added ? 'Added to bag' : 'Add to cart'}
        </Button>
      </div>
    </article>
  );
}
