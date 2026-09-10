import { memo, useId, useState } from 'react';
import Container from '../layout/Container';
import Icon from '../ui/Icon';
import { subscribeToNewsletter } from '../../lib/newsletter';
import styles from './Footer.module.css';

// Every link below resolves to a real storefront route. Customer-care items
// that don't have a dedicated page point to /contact (where the FAQ lives) and
// "Track Order" goes to the customer's own order list.
const COLUMNS = [
  {
    heading: 'Shop',
    links: [
      { label: 'Women', href: '/shop?gender=Women' },
      { label: 'Men', href: '/shop?gender=Men' },
      { label: 'Unisex', href: '/shop?gender=Unisex' },
      { label: 'All Fragrances', href: '/shop' },
      { label: 'Collections', href: '/collections' },
    ],
  },
  {
    heading: 'Customer Care',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'FAQ', href: '/contact' },
      { label: 'Shipping & Returns', href: '/contact' },
      { label: 'Track Order', href: '/account/orders' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'My Account', href: '/account' },
      { label: 'My Orders', href: '/account/orders' },
      { label: 'Wishlist', href: '/wishlist' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About VEDARA', href: '/about' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
];

// VEDARA has no official social profiles in this project yet — these point to
// each platform's site. Swap in the real profile URLs when they go live.
const SOCIAL = [
  { label: 'VEDARA on Instagram', href: 'https://www.instagram.com', icon: 'instagram' },
  { label: 'VEDARA on Pinterest', href: 'https://www.pinterest.com', icon: 'pinterest' },
  { label: 'VEDARA on Facebook', href: 'https://www.facebook.com', icon: 'facebook' },
];

const YEAR = new Date().getFullYear();

/** Compact newsletter sign-up — writes to the same Supabase table as the homepage form. */
function FooterNewsletter() {
  const id = useId();
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [message, setMessage] = useState('');

  const onSubmit = async (event) => {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    const result = await subscribeToNewsletter(email, 'footer');
    if (result.ok) {
      setState('done');
      setMessage(result.already ? 'You’re already on the list — thank you.' : 'Welcome to the VEDARA list.');
      setEmail('');
    } else {
      setState('error');
      setMessage(result.message || 'Something went wrong — please try again.');
    }
  };

  return (
    <form className={styles.newsletter} onSubmit={onSubmit}>
      <label htmlFor={id} className={styles.newsletterLabel}>Join the VEDARA list</label>
      {state === 'done' ? (
        <p className={styles.newsletterNote} role="status">{message}</p>
      ) : (
        <>
          <div className={styles.newsletterRow}>
            <input
              id={id}
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="Email address"
              className={styles.newsletterInput}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button type="submit" className={styles.newsletterButton} disabled={state === 'sending'}>
              {state === 'sending' ? 'Joining…' : 'Subscribe'}
            </button>
          </div>
          {state === 'error' ? <p className={styles.newsletterNote} role="alert">{message}</p> : null}
        </>
      )}
    </form>
  );
}

/** VEDARA storefront footer — brand, navigation, newsletter, legal + social. */
function Footer() {
  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.top}>
          <div className={styles.brand}>
            <a href="/" aria-label="VEDARA — home" className={styles.brandLink}>
              <span className={styles.wordmark}>VEDARA</span>
            </a>
            <p className={styles.tagline}>Wear Your Essence.</p>
            <p className={styles.blurb}>
              A modern fragrance house shaped by Indian perfumery — rose, oud,
              saffron and sandalwood, composed with restraint.
            </p>
            <p className={styles.contact}>
              <a href="mailto:hello@vedara.example" className={styles.contactLink}>hello@vedara.example</a>
              <span aria-hidden="true"> · </span>
              Mon–Fri, 10:00–18:00 IST
            </p>
            <FooterNewsletter />
          </div>

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
          <nav className={styles.legal} aria-label="Legal">
            <a href="/privacy" className={styles.legalLink}>Privacy Policy</a>
            <a href="/terms" className={styles.legalLink}>Terms</a>
          </nav>
          <ul className={styles.social}>
            {SOCIAL.map((social) => (
              <li key={social.icon}>
                <a
                  href={social.href}
                  className={styles.socialLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                >
                  <Icon name={social.icon} size={18} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}

export default memo(Footer);
