import { useEffect, useMemo, useState } from 'react';
import Container from '../layout/Container';
import ProductGrid from './ProductGrid';
import Figure from '../ui/Figure';
import Icon from '../ui/Icon';
import Rating from '../ui/Rating';
import Button from '../ui/Button';
import { useProducts } from '../../hooks/useCatalog';
import { useWishlist } from '../../hooks/useCommerce';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../lib/format';
import styles from './ProductPage.module.css';
import { addCartItem, setPendingPurchase } from '../../lib/commerce';
import ProductReviews from './ProductReviews';

const GALLERY_NOTES = {
  'oudh-noir': ['/images/note-oud.jpg', '/images/note-saffron.jpg', '/images/note-sandalwood.jpg'],
  'amber-veil': ['/images/note-saffron.jpg', '/images/note-vanilla.jpg', '/images/note-jasmine.jpg'],
  'rose-attar': ['/images/note-rose.jpg', '/images/note-jasmine.jpg', '/images/note-sandalwood.jpg'],
  'vetiver-smoke': ['/images/note-oud.jpg', '/images/note-sandalwood.jpg', '/images/note-vanilla.jpg'],
  'jasmine-hour': ['/images/note-jasmine.jpg', '/images/note-rose.jpg', '/images/note-vanilla.jpg'],
  'cardamom-dusk': ['/images/note-vanilla.jpg', '/images/note-saffron.jpg', '/images/note-oud.jpg'],
};

function notify(message) {
  window.dispatchEvent(new CustomEvent('vedara:toast', { detail: { message } }));
}

const go = (path) => { window.location.href = path; };

export default function ProductPage() {
  const slug = window.location.pathname.split('/').filter(Boolean).pop();
  const { products, loading } = useProducts();
  const { isAuthenticated } = useAuth();
  const wishlist = useWishlist();
  const product = products.find((item) => item.slug === slug) || null;
  const notFound = !loading && !product;
  const view = product || products[0];
  const related = useMemo(() => {
    const others = products.filter((item) => item.slug !== view.slug);
    const sameFamily = others.filter((item) => item.category === view.category);
    return [...sameFamily, ...others.filter((item) => item.category !== view.category)].slice(0, 4);
  }, [products, view]);
  const gallery = useMemo(() => {
    if (view.gallery?.length) return [...new Set(view.gallery)];
    return [view.image, ...(GALLERY_NOTES[view.slug] || [])];
  }, [view]);
  const sizes = useMemo(
    () => (view.sizes?.length ? view.sizes : ['30ml', '50ml', '100ml']),
    [view],
  );
  const inStock = view.inStock !== false;
  const wished = wishlist.has(view.slug);
  const [selectedImage, setSelectedImage] = useState(gallery[0]);
  const [zoomed, setZoomed] = useState(false);
  const [size, setSize] = useState(sizes[0]);
  const [quantity, setQuantity] = useState(1);
  const [openDetail, setOpenDetail] = useState('notes');
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    setSelectedImage(gallery[0]);
    setZoomed(false);
  }, [gallery]);

  useEffect(() => {
    setSize((current) => (sizes.includes(current) ? current : sizes[0]));
    setQuantity(1);
  }, [view.slug, sizes]);

  useEffect(() => {
    if (!zoomed) return undefined;
    const closeOnEscape = (event) => event.key === 'Escape' && setZoomed(false);
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [zoomed]);

  const addToCart = () => {
    if (!inStock) return;
    addCartItem(view, quantity, size);
    notify('Added to your collection.');
  };

  /**
   * Buy now:
   *  - logged in  → add the selection to the cart and go straight to /checkout
   *  - logged out → remember the selection and send the user to /login;
   *                 after sign-in they continue to /checkout automatically.
   * The button is disabled while this runs so it cannot fire twice.
   */
  const buyNow = () => {
    if (buying || !inStock) return;
    setBuying(true);
    const selection = {
      slug: view.slug, id: view.id || null, size, quantity,
      name: view.name, image: view.image, price: view.price,
    };

    if (isAuthenticated) {
      addCartItem(view, quantity, size);
      notify('Taking you to checkout…');
      go('/checkout');
      return;
    }

    setPendingPurchase(selection);
    notify('Sign in to complete your purchase — your selection is saved.');
    go(`/login?redirect=${encodeURIComponent('/checkout')}`);
  };

  const toggleWishlist = () => {
    const next = wishlist.toggle(view);
    notify(next ? 'Saved to your wishlist.' : 'Removed from your wishlist.');
  };

  if (notFound) {
    return (
      <main className={styles.page}>
        <Container>
          <div className={styles.notFound}>
            <p className={styles.eyebrow}>Not found</p>
            <h1>We couldn’t find that fragrance.</h1>
            <p>It may have been renamed or is no longer part of the collection.</p>
            <Button as="a" href="/shop" variant="primary">Browse the collection</Button>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <>
      <main className={styles.page}>
        <Container>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <a href="/">Home</a><span>/</span><a href="/shop">Shop</a><span>/</span><span>{view.name}</span>
          </nav>

          <section className={styles.productLayout} aria-labelledby="product-heading">
            <div className={styles.gallery}>
              <div className={styles.thumbnails} aria-label="Product images">
                {gallery.map((image, index) => (
                  <button
                    type="button"
                    key={image}
                    className={styles.thumbnail}
                    data-active={selectedImage === image || undefined}
                    aria-label={`View product image ${index + 1}`}
                    onClick={() => setSelectedImage(image)}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
              <button type="button" className={styles.mainImage} onClick={() => setZoomed(true)} aria-label="Zoom product image">
                <Figure src={selectedImage} alt={`${view.name} fragrance`} ratio="4 / 5" tone="beige" priority />
                <span className={styles.zoomHint}><Icon name="search" size={15} /> View larger</span>
              </button>
            </div>

            <div className={styles.info}>
              <p className={styles.eyebrow}>{view.family}</p>
              <h1 id="product-heading">{view.name}</h1>
              <p className={styles.type}>{view.fragranceType}{view.gender ? ` · ${view.gender}` : ''}</p>
              <div className={styles.ratingRow}><Rating value={Math.round(view.rating || 5)} /><span>{(view.rating || 5).toFixed(1)} · {view.reviewCount || 0} reviews</span></div>
              <div className={styles.priceRow}><span className={styles.price}>{formatPrice(view.price)}</span>{view.originalPrice ? <span className={styles.original}>{formatPrice(view.originalPrice)}</span> : null}</div>
              <p className={styles.description}>{view.shortDescription || `A considered fragrance built around ${(view.notes.heart || view.family).toLowerCase()}.`}</p>

              <fieldset className={styles.sizeSelector}>
                <legend>Size <span>{size}</span></legend>
                <div>{sizes.map((option) => <button type="button" key={option} data-active={size === option || undefined} onClick={() => setSize(option)}>{option}</button>)}</div>
              </fieldset>

              <div className={styles.purchaseRow}>
                <div className={styles.quantity}><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><span>{quantity}</span><button type="button" aria-label="Increase quantity" onClick={() => setQuantity((value) => value + 1)}>+</button></div>
                <Button type="button" variant="primary" className={styles.add} onClick={addToCart} disabled={!inStock}>{inStock ? 'Add to cart' : 'Sold out'}</Button>
                <button type="button" className={styles.wishlist} aria-pressed={wished} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} data-active={wished || undefined} onClick={toggleWishlist}><Icon name="heart" size={20} /></button>
              </div>
              <Button type="button" variant="secondary" fullWidth onClick={buyNow} disabled={buying || !inStock}>{buying ? 'Preparing…' : 'Buy now'}</Button>
              <p className={styles.stock} data-out={!inStock || undefined}><span /> {inStock ? 'In stock · Ready to ship' : 'Currently unavailable'}</p>

              <div className={styles.details}>
                {[
                  ['notes', 'Fragrance notes', <div className={styles.noteGrid}><div><b>Top</b><span>{view.notes.top || '—'}</span></div><div><b>Heart</b><span>{view.notes.heart || '—'}</span></div><div><b>Base</b><span>{view.notes.base || '—'}</span></div></div>],
                  ['profile', 'Fragrance profile', <dl className={styles.profile}><div><dt>Longevity</dt><dd>Long wearing</dd></div><div><dt>Fragrance type</dt><dd>{view.fragranceType}</dd></div><div><dt>Ingredients & care</dt><dd>Store cool, dry and away from direct sunlight.</dd></div></dl>],
                ].map(([key, label, content]) => <div className={styles.detail} key={key}><button type="button" aria-expanded={openDetail === key} onClick={() => setOpenDetail(openDetail === key ? '' : key)}><span>{label}</span><Icon name="arrow" size={16} /></button>{openDetail === key ? <div className={styles.detailContent}>{content}</div> : null}</div>)}
              </div>
            </div>
          </section>
        </Container>

        <ProductReviews productId={view.id} productName={view.name} fallbackCount={view.reviewCount} />

        <section className={styles.related} aria-labelledby="related-heading">
          <Container>
            <div className={styles.relatedHead}><div><p className={styles.eyebrow}>The house edit</p><h2 id="related-heading">You May Also Like</h2></div><a href="/shop">View all <span aria-hidden="true">→</span></a></div>
            <ProductGrid products={related} columns={4} priority />
          </Container>
        </section>
      </main>

      {inStock ? (
        <div className={styles.mobilePurchase}><Button type="button" variant="primary" fullWidth onClick={addToCart}>Add to cart · {formatPrice(view.price)}</Button></div>
      ) : null}

      {zoomed ? <div className={styles.zoomOverlay} role="dialog" aria-modal="true" aria-label="Product image zoom" onClick={() => setZoomed(false)}><img src={selectedImage} alt={`${view.name} enlarged`} /><button type="button" aria-label="Close image zoom" onClick={() => setZoomed(false)}><Icon name="close" size={22} /></button></div> : null}
    </>
  );
}
