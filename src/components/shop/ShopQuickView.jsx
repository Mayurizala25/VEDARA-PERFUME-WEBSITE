import { useEffect, useMemo, useState } from 'react';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Rating from '../ui/Rating';
import { formatPrice, discountPercent } from '../../lib/format';
import { addCartItem, setPendingPurchase } from '../../lib/commerce';
import { useWishlist } from '../../hooks/useCommerce';
import { useAuth } from '../../context/AuthContext';
import styles from './ShopQuickView.module.css';

const go = (path) => { window.location.href = path; };

const NOTE_IMAGES = {
  rose: '/images/note-rose.jpg',
  saffron: '/images/note-saffron.jpg',
  oud: '/images/note-oud.jpg',
  jasmine: '/images/note-jasmine.jpg',
  vanilla: '/images/note-vanilla.jpg',
  sandalwood: '/images/note-sandalwood.jpg',
};

function notify(message) {
  window.dispatchEvent(new CustomEvent('vedara:toast', { detail: { message } }));
}

function buildGallery(product) {
  const scent = Object.values(product.notes).join(' ').toLowerCase();
  const noteImages = Object.entries(NOTE_IMAGES)
    .filter(([word]) => scent.includes(word))
    .map(([, src]) => src);
  return [...new Set([product.image, product.hoverImage, ...noteImages].filter(Boolean))].slice(0, 4);
}

/** ShopQuickView — larger gallery + full detail without leaving the grid. */
export default function ShopQuickView({ product, onClose }) {
  const { isAuthenticated } = useAuth();
  const wishlist = useWishlist();
  const wished = wishlist.has(product.slug);
  const gallery = useMemo(() => buildGallery(product), [product]);
  const [active, setActive] = useState(gallery[0]);
  const [size, setSize] = useState(product.sizes?.[0] || '50ml');
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);

  const soldOut = product.inStock === false;
  const discount = discountPercent(product.price, product.originalPrice);

  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const addToCart = () => {
    if (soldOut) return;
    addCartItem(product, quantity, size);
    notify(`${product.name} added to your bag.`);
    onClose();
  };

  const buyNow = () => {
    if (soldOut || buying) return;
    setBuying(true);
    const selection = {
      slug: product.slug, id: product.id || null, size, quantity,
      name: product.name, image: product.image, price: product.price,
    };
    if (isAuthenticated) {
      addCartItem(product, quantity, size);
      notify('Taking you to checkout…');
      go('/checkout');
      return;
    }
    setPendingPurchase(selection);
    notify('Sign in to complete your purchase — your selection is saved.');
    go(`/login?redirect=${encodeURIComponent('/checkout')}`);
  };

  const toggleWishlist = () => {
    const next = wishlist.toggle(product);
    notify(next ? `${product.name} saved to wishlist.` : `${product.name} removed from wishlist.`);
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-view-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.close} aria-label="Close quick view" onClick={onClose}>
          <Icon name="close" size={22} />
        </button>

        <div className={styles.media}>
          <div className={styles.mainImage}>
            <img src={active} alt={`${product.name} — ${product.fragranceType}`} />
            {discount ? <span className={styles.discount}>−{discount}%</span> : null}
          </div>
          {gallery.length > 1 ? (
            <div className={styles.thumbs} aria-label="Product images">
              {gallery.map((image, index) => (
                <button
                  type="button"
                  key={image}
                  className={styles.thumb}
                  data-active={active === image || undefined}
                  aria-label={`View image ${index + 1}`}
                  onClick={() => setActive(image)}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.info}>
          <p className={styles.family}>{product.family}</p>
          <h2 id="quick-view-heading">{product.name}</h2>
          <p className={styles.type}>{product.fragranceType}</p>

          <div className={styles.ratingRow}>
            <Rating value={Math.round(product.rating)} />
            <span>{product.rating.toFixed(1)} · {product.reviewCount} reviews</span>
          </div>

          <p className={styles.price}>
            <span className={discount ? styles.now : undefined}>{formatPrice(product.price)}</span>
            {product.originalPrice ? <span className={styles.was}>{formatPrice(product.originalPrice)}</span> : null}
          </p>

          <p className={styles.description}>{product.shortDescription}</p>

          <dl className={styles.notes}>
            <div><dt>Top</dt><dd>{product.notes.top}</dd></div>
            <div><dt>Heart</dt><dd>{product.notes.heart}</dd></div>
            <div><dt>Base</dt><dd>{product.notes.base}</dd></div>
          </dl>

          <fieldset className={styles.sizes}>
            <legend>Size <span>{size}</span></legend>
            <div>
              {product.sizes.map((option) => (
                <button
                  type="button"
                  key={option}
                  data-active={size === option || undefined}
                  onClick={() => setSize(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <p className={styles.stock} data-out={soldOut || undefined}>
            <span aria-hidden="true" />
            {soldOut ? 'Currently unavailable' : 'In stock · ships in 2–4 days'}
          </p>

          <div className={styles.actions}>
            <div className={styles.quantity}>
              <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((v) => Math.max(1, v - 1))}>−</button>
              <span>{quantity}</span>
              <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((v) => v + 1)}>+</button>
            </div>
            <Button type="button" variant="primary" className={styles.add} disabled={soldOut} onClick={addToCart}>
              {soldOut ? 'Sold out' : 'Add to cart'}
            </Button>
            <button
              type="button"
              className={styles.wish}
              aria-pressed={wished}
              aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
              data-active={wished || undefined}
              onClick={toggleWishlist}
            >
              <Icon name="heart" size={20} />
            </button>
          </div>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            className={styles.buyNow}
            disabled={soldOut || buying}
            onClick={buyNow}
          >
            {buying ? 'Preparing…' : 'Buy now'}
          </Button>

          <a className={styles.fullLink} href={`/product/${product.slug}`}>View full details</a>
        </div>
      </section>
    </div>
  );
}
