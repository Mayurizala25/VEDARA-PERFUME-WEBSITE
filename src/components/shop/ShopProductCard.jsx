import { useState } from 'react';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import Rating from '../ui/Rating';
import { formatPrice, discountPercent } from '../../lib/format';
import { addCartItem } from '../../lib/commerce';
import { useWishlist } from '../../hooks/useCommerce';
import styles from './ShopProductCard.module.css';

function notify(message) {
  window.dispatchEvent(new CustomEvent('vedara:toast', { detail: { message } }));
}

/**
 * ShopProductCard — the premium catalogue card used on /shop.
 * Shows secondary image + zoom on hover, sizes, stock, rating, wishlist,
 * quick view and an animated add-to-cart. Placeholder data only.
 */
export default function ShopProductCard({ product, onQuickView, priority = false }) {
  const wishlist = useWishlist();
  const wished = wishlist.has(product.slug);
  const [added, setAdded] = useState(false);

  const onSale = Boolean(product.originalPrice);
  const discount = discountPercent(product.price, product.originalPrice);
  const soldOut = product.inStock === false;

  const badges = [];
  if (product.badges.includes('new')) badges.push({ key: 'new', label: 'New Arrival' });
  if (product.badges.includes('bestseller')) badges.push({ key: 'best', label: 'Best Seller' });
  if (discount) badges.push({ key: 'sale', label: `−${discount}%` });

  const addToCart = () => {
    if (soldOut) return;
    addCartItem(product, 1, product.sizes?.[0] || '50ml');
    setAdded(true);
    notify(`${product.name} added to your bag.`);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const toggleWishlist = () => {
    const next = wishlist.toggle(product);
    notify(next ? `${product.name} saved to wishlist.` : `${product.name} removed from wishlist.`);
  };

  return (
    <article className={styles.card} data-sold-out={soldOut || undefined}>
      <div className={styles.media}>
        <a className={styles.mediaLink} href={`/product/${product.slug}`} aria-label={`View ${product.name}`}>
          <img
            className={styles.image}
            src={product.image}
            alt={`${product.name} — ${product.fragranceType}`}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            {...(priority ? { fetchpriority: 'high' } : {})}
          />
          {product.hoverImage ? (
            <img
              className={styles.imageAlt}
              src={product.hoverImage}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
          ) : null}
        </a>

        {badges.length ? (
          <ul className={styles.badges}>
            {badges.map((badge) => (
              <li key={badge.key} data-variant={badge.key}>{badge.label}</li>
            ))}
          </ul>
        ) : null}

        {soldOut ? <span className={styles.soldOutTag}>Sold out</span> : null}

        <button
          type="button"
          className={styles.wish}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          data-active={wished || undefined}
          onClick={toggleWishlist}
        >
          <Icon name="heart" size={18} />
        </button>

        {onQuickView ? (
          <button type="button" className={styles.quickView} onClick={() => onQuickView(product)}>
            Quick view
          </button>
        ) : null}
      </div>

      <div className={styles.body}>
        <p className={styles.family}>{product.family}</p>
        <h3 className={styles.name}>
          <a href={`/product/${product.slug}`}>{product.name}</a>
        </h3>
        <p className={styles.description}>{product.shortDescription}</p>

        <p className={styles.ratingRow}>
          <Rating value={Math.round(product.rating)} className={styles.stars} />
          <span>{product.rating.toFixed(1)}</span>
          <span className={styles.reviewCount}>({product.reviewCount})</span>
        </p>

        <p className={styles.price}>
          <span className={onSale ? styles.now : undefined}>{formatPrice(product.price)}</span>
          {onSale ? <span className={styles.was}>{formatPrice(product.originalPrice)}</span> : null}
        </p>

        <ul className={styles.sizes} aria-label="Available sizes">
          {product.sizes.map((size) => (
            <li key={size}>{size}</li>
          ))}
        </ul>

        <p className={styles.stock} data-out={soldOut || undefined}>
          <span aria-hidden="true" />
          {soldOut ? 'Currently unavailable' : 'In stock'}
        </p>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={styles.add}
          disabled={soldOut}
          data-added={added || undefined}
          onClick={addToCart}
        >
          {soldOut ? 'Sold out' : added ? 'Added to bag' : 'Add to cart'}
        </Button>
      </div>
    </article>
  );
}
