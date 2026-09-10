import { useCallback, useEffect, useRef, useState } from 'react';
import Container from '../layout/Container';
import Icon from '../ui/Icon';
import AnnouncementBar from './AnnouncementBar';
import { useCartCount } from '../../hooks/useCommerce';
import { useAuth } from '../../context/AuthContext';
import styles from './Header.module.css';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Collections', href: '/collections' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

const DESKTOP_QUERY = '(min-width: 960px)';

/**
 * Header — floating site header: announcement bar, VEDARA logo, primary
 * navigation, wishlist + cart, and a full-height mobile menu.
 * Transparent (Champagne type) over the hero; refines to a solid Warm Ivory
 * bar with Deep Charcoal type once the page scrolls. The announcement bar
 * collapses on scroll.
 */
export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInput = useRef(null);
  const menuButton = useRef(null);
  const firstMenuLink = useRef(null);
  const cartTotal = useCartCount();
  const { isAuthenticated: authed } = useAuth();
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const currentPath = window.location.pathname;
  const isHome = currentPath === '/';
  const isActive = (href) =>
    (href === '/'
      ? isHome
      : currentPath === href || currentPath.startsWith(`${href}/`)) || undefined;
  const submitSearch = (event) => {
    event.preventDefault();
    const term = searchTerm.trim();
    window.location.href = term ? `/shop?q=${encodeURIComponent(term)}` : '/shop';
  };

  // Scrolled state (bar refinement) + hide-on-scroll-down / reveal-on-scroll-up.
  // The hide behaviour is mobile-only and disabled under reduced-motion; the
  // header always shows near the top of the page. rAF-throttled, ~8px dead zone.
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 959px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lastY = window.scrollY;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = Math.max(0, window.scrollY);
      setScrolled(y > 12);
      if (mobile.matches && !reduce.matches) {
        if (y < 60) setHidden(false);
        else if (Math.abs(y - lastY) > 8) setHidden(y > lastY);
      } else {
        setHidden(false);
      }
      lastY = y;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!searchOpen) return undefined;
    searchInput.current?.focus();
    const closeOnEscape = (event) => event.key === 'Escape' && setSearchOpen(false);
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [searchOpen]);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const handle = (event) => event.matches && setMenuOpen(false);
    mql.addEventListener('change', handle);
    return () => mql.removeEventListener('change', handle);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    // Move focus into the panel; restore it to the toggle on close.
    const restoreTo = menuButton.current;
    firstMenuLink.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
      restoreTo?.focus();
    };
  }, [menuOpen]);

  return (
    <header
      className={styles.header}
      data-scrolled={scrolled || undefined}
      data-menu-open={menuOpen || undefined}
      data-hidden={(hidden && !menuOpen && !searchOpen) || undefined}
      data-home={isHome || undefined}
    >
      <div className={styles.announcement}>
        <AnnouncementBar />
      </div>

      <div className={styles.bar}>
        <Container className={styles.inner}>
          <button
            ref={menuButton}
            type="button"
            className={styles.menuButton}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className={styles.menuIcon} data-open={menuOpen || undefined} aria-hidden="true" />
          </button>

          <a href="/" className={styles.brand} aria-label="VEDARA — home">
            VEDARA
          </a>

          <nav className={styles.desktopNav} aria-label="Primary">
            <ul className={styles.navList}>
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className={styles.navLink} data-active={isActive(link.href)}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={searchOpen ? 'Close search' : 'Search'}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <Icon name="search" size={20} />
            </button>
            <a
              href={authed ? '/account' : '/login'}
              className={styles.iconButton}
              aria-label={authed ? 'Your account' : 'Sign in'}
            >
              <Icon name="user" size={20} />
            </a>
            <a
              href="/wishlist"
              className={`${styles.iconButton} ${styles.wishlistAction}`}
              aria-label="Wishlist"
            >
              <Icon name="heart" size={20} />
            </a>
            <a href="/cart" className={styles.iconButton} aria-label={`Cart, ${cartTotal} items`}>
              <BagIcon />
              <span className={styles.count} aria-hidden="true">
                {cartTotal}
              </span>
            </a>
          </div>
        </Container>
      </div>

      <form
        className={styles.searchPanel}
        data-open={searchOpen || undefined}
        role="search"
        onSubmit={submitSearch}
      >
        <label htmlFor="site-search" className="visually-hidden">Search VEDARA</label>
        <input ref={searchInput} id="site-search" type="search" placeholder="Search fragrances" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        <button type="submit" className={styles.searchSubmit}>Search</button>
      </form>

      <div
        id="mobile-nav"
        className={styles.mobilePanel}
        data-open={menuOpen || undefined}
        aria-hidden={!menuOpen}
        inert={!menuOpen ? '' : undefined}
      >
        <nav aria-label="Mobile" className={styles.mobileNav}>
          <ul className={styles.mobileNavList}>
            {NAV_LINKS.map((link, index) => (
              <li key={link.label}>
                <a
                  ref={index === 0 ? firstMenuLink : undefined}
                  href={link.href}
                  className={styles.mobileNavLink}
                  data-active={isActive(link.href)}
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className={styles.mobileSecondaryRow}>
            <a href="/wishlist" className={styles.mobileSecondary} onClick={closeMenu}>
              <Icon name="heart" size={18} />
              Wishlist
            </a>
            <a href={authed ? '/account' : '/login'} className={styles.mobileSecondary} onClick={closeMenu}>
              <Icon name="user" size={18} />
              {authed ? 'Account' : 'Sign in'}
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}

function BagIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
