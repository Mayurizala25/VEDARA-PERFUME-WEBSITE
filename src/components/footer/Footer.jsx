import { memo } from 'react';
import Container from '../layout/Container';
import Icon from '../ui/Icon';
import styles from './Footer.module.css';

// Every link resolves to a real storefront route.
const NAV = [
  { label: 'Shop', href: '/shop' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

// WhatsApp contact — wa.me expects the number in international format, digits only.
const WHATSAPP_NUMBER = '918530165142';
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}`;

const YEAR = new Date().getFullYear();

/** VEDARA storefront footer — compact editorial bar: brand · nav · WhatsApp. */
function Footer() {
  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.inner}>
          <div className={styles.brand}>
            <a href="/" aria-label="VEDARA — home" className={styles.brandLink}>
              <span className={styles.wordmark}>VEDARA</span>
            </a>
            <p className={styles.tagline}>Wear Your Essence.</p>
          </div>

          <nav className={styles.nav} aria-label="Footer">
            {NAV.map((item) => (
              <a key={item.label} href={item.href} className={styles.link}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className={styles.right}>
            <a
              href={WHATSAPP_HREF}
              className={styles.whatsapp}
              target="_blank"
              rel="noreferrer"
              aria-label="Message VEDARA on WhatsApp"
            >
              <Icon name="whatsapp" size={18} />
              <span>WhatsApp</span>
            </a>
            <p className={styles.copy}>© {YEAR} VEDARA</p>
          </div>
        </div>
      </Container>
    </footer>
  );
}

export default memo(Footer);
