import { lazy, Suspense, useEffect, useState } from 'react';
import Header from './components/header/Header';
import Hero from './components/hero/Hero';
import FeaturedCollection from './components/sections/FeaturedCollection';
import ShopByFragrance from './components/sections/ShopByFragrance';
import BestSeller from './components/sections/BestSeller';
import BrandStory from './components/sections/BrandStory';
import WhyVedara from './components/sections/WhyVedara';
import FragranceNotes from './components/sections/FragranceNotes';
import Reviews from './components/sections/Reviews';
import Lifestyle from './components/sections/Lifestyle';
import Newsletter from './components/sections/Newsletter';
import Footer from './components/footer/Footer';
import Icon from './components/ui/Icon';
import ShopPage from './components/shop/ShopPage';
import ProductPage from './components/product/ProductPage';
import CollectionsPage from './components/collections/CollectionsPage';
import CollectionDetailPage from './components/collections/CollectionDetailPage';
import {
  AboutPage,
  AccountPage,
  CartPage,
  CheckoutPage,
  ContactPage,
  LoginPage,
  OrderSuccessPage,
  PrivacyPage,
  TermsPage,
  WishlistPage,
} from './components/pages/CustomerPages';
import { CustomerOrderDetailPage, CustomerOrdersPage } from './components/pages/CustomerOrdersPage';
import styles from './App.module.css';

// The owner panel is a separate app (its own router + chrome). Lazy-loaded so
// none of its code — or react-router — ships to storefront visitors.
const AdminApp = lazy(() => import('./admin/AdminApp'));

const IS_ADMIN = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');

/** Entry point — hands off to the admin panel under /admin, storefront otherwise. */
export default function App() {
  if (IS_ADMIN) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: 'var(--color-muted)' }}>Loading admin…</div>}>
        <AdminApp />
      </Suspense>
    );
  }
  return <Storefront />;
}

/** VEDARA — storefront shell. */
function Storefront() {
  const [toast, setToast] = useState('');
  const [showTop, setShowTop] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const isShop = window.location.pathname === '/shop';
  const isProduct = window.location.pathname.startsWith('/product/');
  const path = window.location.pathname;
  const isOrderDetail = path.startsWith('/account/orders/') && path.length > '/account/orders/'.length;
  const isCollectionDetail = path.startsWith('/collections/') && path.length > '/collections/'.length;
  const Page = path === '/collections' ? CollectionsPage
    : isCollectionDetail ? CollectionDetailPage
      : path === '/about' ? AboutPage
        : path === '/contact' ? ContactPage
          : path === '/privacy' ? PrivacyPage
          : path === '/terms' ? TermsPage
          : path === '/wishlist' ? WishlistPage
            : path === '/cart' ? CartPage
              : path === '/checkout' ? CheckoutPage
                : path === '/order-success' ? OrderSuccessPage
                  : path === '/login' ? LoginPage
                    : path === '/account' ? AccountPage
                      : path === '/account/orders' ? CustomerOrdersPage
                      : isOrderDetail ? () => <CustomerOrderDetailPage id={decodeURIComponent(path.split('/').pop())} />
                      : null;

  useEffect(() => {
    const showToast = (event) => {
      setToast(event.detail?.message || 'Added to your collection.');
      window.clearTimeout(showToast.timeout);
      showToast.timeout = window.setTimeout(() => setToast(''), 2600);
    };
    window.addEventListener('vedara:toast', showToast);
    return () => {
      window.removeEventListener('vedara:toast', showToast);
      window.clearTimeout(showToast.timeout);
    };
  }, []);

  useEffect(() => {
    if (window.location.pathname !== '/') return undefined;
    if (window.localStorage.getItem('vedara-welcome-dismissed')) return undefined;
    const timer = window.setTimeout(() => setWelcomeOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 720);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <Header />
      <main id="main">
        {isProduct ? (
          <ProductPage />
        ) : isShop ? (
          <ShopPage />
        ) : Page ? (
          <Page />
        ) : (
          <>
            <Hero />
            <FeaturedCollection />
            <ShopByFragrance />
            <BestSeller />
            <BrandStory />
            <FragranceNotes />
            <WhyVedara />
            <Lifestyle />
            <Reviews />
            <Newsletter />
          </>
        )}
      </main>
      <Footer />
      {welcomeOpen ? (
        <div className={styles.welcomeOverlay} role="presentation" onClick={() => setWelcomeOpen(false)}>
          <section className={styles.welcome} role="dialog" aria-modal="true" aria-labelledby="welcome-heading" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.welcomeClose}
              aria-label="Close welcome message"
              onClick={() => { window.localStorage.setItem('vedara-welcome-dismissed', 'true'); setWelcomeOpen(false); }}
            >
              <Icon name="close" size={20} />
            </button>
            <div className={styles.welcomeImage} aria-hidden="true" />
            <div className={styles.welcomeCopy}>
              <p className="eyebrow">Welcome to VEDARA</p>
              <h2 id="welcome-heading">Enter a world where fragrance becomes your signature.</h2>
              <button type="button" className={styles.welcomeCta} onClick={() => { window.localStorage.setItem('vedara-welcome-dismissed', 'true'); setWelcomeOpen(false); window.location.href = '/shop'; }}>
                Discover VEDARA
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <p className={styles.toast} role="status" data-visible={toast || undefined}>
        {toast}
      </p>
      <button
        type="button"
        className={styles.backTop}
        data-visible={showTop || undefined}
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <Icon name="arrow" size={18} />
      </button>
    </>
  );
}
