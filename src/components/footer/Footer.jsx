import Container from '../layout/Container';
import Icon from '../ui/Icon';
import styles from './Footer.module.css';

const COLUMNS = [
  {
    heading: 'Shop',
    links: [
      { label: 'All Fragrances', href: '/shop' },
      { label: 'Best Sellers', href: '/shop?best=1' },
      { label: 'New Arrivals', href: '/shop?new=1' },
      { label: 'Woody', href: '/shop?family=Woody' },
    ],
  },
  {
    heading: 'House',
    links: [
      { label: 'Our Story', href: '/about' },
      { label: 'Sourcing', href: '/about' },
      { label: 'Journal', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Shipping & Returns', href: '/contact' },
      { label: 'Refills', href: '/contact' },
      { label: 'FAQs', href: '/contact' },
      { label: 'Track Order', href: '/contact' },
    ],
  },
];

const YEAR = new Date().getFullYear();

/** Refined editorial luxury footer. */
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.masthead}>
          <a href="/" aria-label="VEDARA — home" className={styles.brandLink}>
            <span className={styles.wordmark}>VEDARA</span>
          </a>
          <p className={styles.tagline}>Wear Your Essence.</p>
          <p className={styles.blurb}>
            A modern fragrance house shaped by Indian perfumery — rose, oud,
            saffron and sandalwood, composed with restraint.
          </p>
        </div>

        <div className={styles.grid}>
          <nav className={styles.columns} aria-label="Footer">
            {COLUMNS.map((col) => (
              <div key={col.heading} className={styles.column}>
                <h2 className={styles.colHeading}>{col.heading}</h2>
                <ul>
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className={styles.link}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copy}>© {YEAR} VEDARA. All rights reserved.</p>
          <p className={styles.note}>Frontend demo · placeholder content</p>
          <div className={styles.social}>
            <a href="/" className={styles.socialLink} aria-label="VEDARA on Instagram">
              <Icon name="instagram" size={18} />
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
