import { useEffect, useMemo, useState } from 'react';
import Container from '../layout/Container';
import SectionHeading from '../common/SectionHeading';
import Figure from '../ui/Figure';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { useProducts } from '../../hooks/useCatalog';
import { useCart, useWishlist } from '../../hooks/useCommerce';
import { useAuth } from '../../context/AuthContext';
import { flushPendingPurchase, readCheckoutDetails, readCoupon, writeCheckoutDetails, writeCoupon } from '../../lib/commerce';
import { validateCoupon } from '../../lib/coupons';
import { computeTotals, getMyOrders, getOrderByNumber, placeOrder, stockProblems } from '../../lib/orders';
import { submitEnquiry } from '../../lib/contact';
import { formatDate, formatPrice } from '../../lib/format';
import styles from './CustomerPages.module.css';

const go = (path) => { window.location.href = path; };

function PageHero({ eyebrow, title, intro, image }) {
  return <section className={styles.pageHero}><div className={styles.pageHeroImage} style={{ backgroundImage: `url(${image})` }} /><Container className={styles.pageHeroInner}><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p>{intro}</p></Container></section>;
}

function EmptyState({ title, text, action, href }) {
  return <div className={styles.emptyState}><p className={styles.eyebrow}>VEDARA</p><h2>{title}</h2><p>{text}</p><Button as="a" href={href} variant="primary">{action}</Button></div>;
}

/* ================================================================= About */

export function AboutPage() {
  return <>
    <PageHero eyebrow="The House" title="Rooted in ritual. Reimagined for now." intro="VEDARA is a modern fragrance house shaped by Indian perfumery and the quiet power of considered materials." image="/images/story.jpg" />
    <main className={styles.pageBody}><Container>
      <section className={styles.editorialSplit}><div><p className={styles.eyebrow}>Our story</p><h2>A contemporary voice for the attar tradition.</h2><p>VEDARA began with a simple belief: the rose, jasmine, oud and sandalwood of Indian perfumery deserve a modern language. We compose with restraint, letting a few beautiful materials speak clearly.</p><p>Each fragrance is imagined as a personal ritual, made to settle into the skin and become part of the person wearing it.</p><p className={styles.pullQuote}>“Wear your essence, never someone else’s.”</p></div><Figure src="/images/bestseller.jpg" alt="VEDARA fragrance and satin ribbon" ratio="4 / 5" /></section>
      <section className={styles.values}><SectionHeading eyebrow="The craft" title="Materials with a point of view" align="center" /><div className={styles.valueGrid}><div><Icon name="leaf" size={28} /><h3>Indian ingredients</h3><p>Rose, jasmine, saffron, oud and sandalwood interpreted with a contemporary hand.</p></div><div><Icon name="flask" size={28} /><h3>Small-batch thinking</h3><p>Compositions are developed slowly, with space for balance and character.</p></div><div><Icon name="ribbon" size={28} /><h3>Quiet presentation</h3><p>Refined flacons and warm materials keep attention on what you wear.</p></div></div></section>
    </Container></main>
  </>;
}

/* =============================================================== Contact */

export function ContactPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [errorText, setErrorText] = useState('');
  const [openFaq, setOpenFaq] = useState(0);

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    setStatus('sending');
    setErrorText('');
    const f = form.elements;
    const result = await submitEnquiry({
      name: f.name.value,
      email: f.email.value,
      phone: f.phone.value,
      subject: f.subject.value,
      message: f.message.value,
    });
    if (result.ok) { setStatus('success'); form.reset(); }
    else { setStatus('error'); setErrorText('Something went wrong sending your message. Please try again.'); }
  };

  const faqs = [
    ['How should I store my fragrance?', 'Keep your fragrance in a cool, dry place away from direct sunlight and temperature changes.'],
    ['Do you offer samples?', 'Complimentary samples are part of the VEDARA experience. Mention it in your enquiry and we will include them with your order.'],
    ['Can I track my order?', 'Once signed in, every order appears under your account with its current status.'],
  ];

  return <>
    <PageHero eyebrow="The House" title="We would love to hear from you." intro="Questions about a fragrance, a gift or the VEDARA world? Send us a note." image="/images/lifestyle.jpg" />
    <main className={styles.pageBody}><Container><section className={styles.contactLayout}>
      <div>
        <p className={styles.eyebrow}>Start a conversation</p>
        <h2>Tell us what you’re looking for.</h2>
        <p className={styles.muted}>hello@vedara.example · Monday to Friday, 10:00–18:00 IST.</p>
        <form className={styles.form} onSubmit={submit} noValidate>
          <label>Name<input name="name" required minLength={2} defaultValue={user?.user_metadata?.full_name || ''} /></label>
          <div className={styles.formRow}>
            <label>Email<input name="email" type="email" required defaultValue={user?.email || ''} /></label>
            <label>Phone<input name="phone" type="tel" autoComplete="tel" placeholder="Optional" /></label>
          </div>
          <label>Subject<input name="subject" required minLength={3} placeholder="Fragrance advice, order support…" /></label>
          <label>Message<textarea name="message" rows="5" required minLength={10} /></label>
          <Button type="submit" variant="primary" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send enquiry'}</Button>
          {status === 'success' ? <p className={styles.formSuccess} role="status">Thank you. Your message has reached the VEDARA team — we’ll be in touch soon.</p> : null}
          {status === 'error' ? <p className={styles.formError} role="alert">{errorText}</p> : null}
        </form>
      </div>
      <div className={styles.faq}>
        <p className={styles.eyebrow}>Questions, answered</p>
        <h2>Frequently asked</h2>
        {faqs.map(([question, answer], index) => <div className={styles.faqItem} key={question}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>{question}<Icon name="arrow" size={16} /></button>{openFaq === index ? <p>{answer}</p> : null}</div>)}
      </div>
    </section></Container></main>
  </>;
}

/* ================================================================= Legal */

export function PrivacyPage() {
  return <>
    <PageHero eyebrow="Legal" title="Privacy Policy" intro="How VEDARA handles the information you share with us." image="/images/story.jpg" />
    <main className={styles.pageBody}><Container><div className={styles.legal}>
      <p className={styles.legalMeta}>This is a demonstration storefront.</p>

      <h2>What we collect</h2>
      <p>When you create an account we store your name, email address and — if you add it — your phone number. When you place an order we store the items, totals and the shipping address you enter. If you join our newsletter we store your email address so we can write to you about VEDARA.</p>

      <h2>Where it is stored</h2>
      <p>Account, order and newsletter data is held in our database (Supabase) and protected by row-level security, so you can only ever read your own account and your own orders. Administrative access is limited to VEDARA staff.</p>

      <h2>Payments</h2>
      <p>This storefront does not process real card payments and does not store any payment details.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Update your name and phone number at any time from <a href="/account">your account</a>.</li>
        <li>Unsubscribe from newsletter emails using the link in any email we send.</li>
        <li>Ask us to remove your data by writing to <a href="mailto:hello@vedara.example">hello@vedara.example</a>.</li>
      </ul>

      <h2>Contact</h2>
      <p>Questions about your data? Email <a href="mailto:hello@vedara.example">hello@vedara.example</a> or use the <a href="/contact">contact page</a>.</p>
    </div></Container></main>
  </>;
}

export function TermsPage() {
  return <>
    <PageHero eyebrow="Legal" title="Terms of Use" intro="The basis on which you may use the VEDARA website." image="/images/lifestyle.jpg" />
    <main className={styles.pageBody}><Container><div className={styles.legal}>
      <p className={styles.legalMeta}>This is a demonstration storefront.</p>

      <h2>Using this site</h2>
      <p>You may browse VEDARA and create an account for your personal, non-commercial use. Keep your login details secure — you are responsible for activity on your account.</p>

      <h2>Products and pricing</h2>
      <p>Fragrance descriptions and imagery are presented as accurately as we can. Prices are shown in Indian Rupees and may change. Placing an order is an offer to buy, which we may accept or decline.</p>

      <h2>Orders and fulfilment</h2>
      <p>This is a demonstration storefront: no payment is taken and no goods are dispatched. Order records exist so you can see how the account and order flow works.</p>

      <h2>Content</h2>
      <p>The VEDARA name, wordmark, text and imagery on this site belong to VEDARA and may not be reused without permission.</p>

      <h2>Contact</h2>
      <p>Questions about these terms? Email <a href="mailto:hello@vedara.example">hello@vedara.example</a>.</p>
    </div></Container></main>
  </>;
}

/* ============================================================== Wishlist */

export function WishlistPage() {
  const { products, loading } = useProducts();
  const wishlist = useWishlist();
  const cart = useCart();
  const saved = useMemo(
    () => products.filter((product) => wishlist.slugs.includes(product.slug)),
    [products, wishlist.slugs],
  );

  return <>
    <PageHero eyebrow="Your VEDARA" title="Wishlist" intro="Keep the fragrances you are drawn to close." image="/images/product-rose-attar.jpg" />
    <main className={styles.pageBody}><Container>
      {loading && !saved.length ? (
        <p className={styles.muted}>Loading your saved fragrances…</p>
      ) : saved.length ? <>
        <div className={styles.pageHeading}><p className={styles.eyebrow}>{saved.length} saved fragrance{saved.length > 1 ? 's' : ''}</p><h2>Your considered edit</h2></div>
        <div className={styles.wishlistGrid}>{saved.map((product) => (
          <article className={styles.savedCard} key={product.slug}>
            <a href={`/product/${product.slug}`}><Figure src={product.image} alt={product.name} ratio="4 / 5" /></a>
            <div>
              <p className={styles.eyebrow}>{product.family}</p>
              <h3>{product.name}</h3>
              <p>{formatPrice(product.price)}</p>
              <div className={styles.cardActions}>
                <Button type="button" variant="primary" size="sm" disabled={product.inStock === false} onClick={() => cart.add(product, 1, product.sizes?.[0])}>
                  {product.inStock === false ? 'Sold out' : 'Add to cart'}
                </Button>
                <button type="button" onClick={() => wishlist.toggle(product)} aria-label={`Remove ${product.name} from wishlist`}><Icon name="close" size={17} /></button>
              </div>
            </div>
          </article>
        ))}</div>
      </> : <EmptyState title="Your wishlist is waiting." text="Save a fragrance when it catches your attention and return to it here." action="Explore the collection" href="/shop" />}
    </Container></main>
  </>;
}

/* ================================================================== Cart */

export function CartPage() {
  const { items, subtotal, update, remove } = useCart();
  const shipping = subtotal >= 2500 || subtotal === 0 ? 0 : 250;

  return <>
    <PageHero eyebrow="Your VEDARA" title="Your collection" intro="A quiet place for the fragrances you have chosen." image="/images/product-amber-veil.jpg" />
    <main className={styles.pageBody}><Container>
      {items.length ? (
        <div className={styles.cartLayout}>
          <section>
            <div className={styles.pageHeading}><p className={styles.eyebrow}>{items.reduce((n, i) => n + i.quantity, 0)} pieces</p><h2>Ready when you are.</h2></div>
            <div className={styles.cartItems}>{items.map((item) => (
              <article className={styles.cartItem} key={`${item.slug}-${item.size}`}>
                <Figure src={item.image} alt={item.name} ratio="1 / 1" />
                <div>
                  <p className={styles.eyebrow}>{item.size}</p>
                  <h3><a href={`/product/${item.slug}`}>{item.name}</a></h3>
                  <p>{formatPrice(item.price)}</p>
                  <div className={styles.cartControls}>
                    <div className={styles.quantity}>
                      <button type="button" onClick={() => update(item.slug, item.size, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => update(item.slug, item.size, item.quantity + 1)} aria-label="Increase quantity">+</button>
                    </div>
                    <button type="button" onClick={() => remove(item.slug, item.size)}>Remove</button>
                  </div>
                </div>
              </article>
            ))}</div>
          </section>
          <aside className={styles.summary}>
            <h2>Summary</h2>
            <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
            <div><span>Shipping</span><strong>{shipping ? formatPrice(shipping) : 'Complimentary'}</strong></div>
            <div className={styles.total}><span>Total</span><strong>{formatPrice(subtotal + shipping)}</strong></div>
            <Button as="a" href="/checkout" variant="primary" fullWidth>Continue to checkout</Button>
          </aside>
        </div>
      ) : <EmptyState title="Your collection is empty." text="Begin with a fragrance and build a signature that is yours." action="Shop fragrances" href="/shop" />}
    </Container></main>
  </>;
}

/* ============================================================== Checkout */

export function CheckoutPage() {
  const { user, profile, loading: authLoading, isAuthenticated } = useAuth();
  const { items, subtotal } = useCart();
  const { products } = useProducts();
  const saved = readCheckoutDetails();
  const storedCoupon = readCoupon();
  const initialCouponCode = storedCoupon?.code || '';
  const [coupon, setCoupon] = useState(storedCoupon || null);
  const [couponCode, setCouponCode] = useState(initialCouponCode);
  const [couponMsg, setCouponMsg] = useState('');
  const [details, setDetails] = useState(() => ({
    fullName: profile?.full_name || user?.user_metadata?.full_name || saved.fullName || '',
    email: user?.email || saved.email || '',
    phone: profile?.phone || saved.phone || '',
    address: saved.address || '',
    city: saved.city || '',
    state: saved.state || '',
    pincode: saved.pincode || '',
    country: saved.country || 'India',
    notes: saved.notes || '',
    addresses: Array.isArray(saved.addresses) ? saved.addresses : [],
    selectedAddressId: saved.selectedAddressId || '',
  }));
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) go('/login?redirect=/checkout');
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    const persisted = readCheckoutDetails();
    if (!persisted.addresses || !persisted.addresses.length) {
      const existing = profile?.full_name || user?.user_metadata?.full_name || '';
      const next = {
        fullName: existing,
        email: user?.email || persisted.email || '',
        phone: profile?.phone || persisted.phone || '',
        address: persisted.address || '',
        city: persisted.city || '',
        state: persisted.state || '',
        pincode: persisted.pincode || '',
        country: persisted.country || 'India',
        notes: persisted.notes || '',
        addresses: Array.isArray(persisted.addresses) ? persisted.addresses : [],
        selectedAddressId: persisted.selectedAddressId || '',
      };
      setDetails(next);
      writeCheckoutDetails(next);
    }
  }, [authLoading, isAuthenticated, user, profile]);

  const totals = computeTotals(items, products, coupon);

  const applyCoupon = async (event) => {
    event.preventDefault();
    setError('');
    setCouponMsg('');
    const result = await validateCoupon(couponCode);
    if (!result.valid) {
      setCoupon(null);
      setCouponCode('');
      writeCoupon(null);
      setCouponMsg(result.message || 'That code is not valid.');
      return;
    }
    setCoupon(result);
    writeCoupon(result);
    setCouponCode(result.code || couponCode.trim().toUpperCase());
    setCouponMsg(`${result.code || couponCode.trim().toUpperCase()} applied.`);
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponCode('');
    writeCoupon(null);
    setCouponMsg('');
  };

  const selectAddress = (id) => {
    const selected = details.addresses.find((a) => a.id === id) || details.addresses[0];
    if (!selected) return;
    const next = { ...details, selectedAddressId: selected.id, fullName: selected.fullName || details.fullName, phone: selected.phone || details.phone, address: selected.address || details.address, city: selected.city || details.city, state: selected.state || details.state, pincode: selected.pincode || details.pincode, country: selected.country || details.country, notes: selected.notes || details.notes };
    setDetails(next);
    writeCheckoutDetails(next);
  };

  const saveAddress = (payload) => {
    const normalized = {
      id: payload.id || `addr-${Date.now()}`,
      fullName: payload.fullName || details.fullName,
      phone: payload.phone || details.phone,
      address: payload.address || details.address,
      city: payload.city || details.city,
      state: payload.state || details.state,
      pincode: payload.pincode || details.pincode,
      country: payload.country || details.country,
      notes: payload.notes || details.notes,
      createdAt: payload.createdAt || new Date().toISOString(),
    };
    const existing = details.addresses || [];
    const addresses = existing.some((a) => a.id === normalized.id)
      ? existing.map((a) => (a.id === normalized.id ? normalized : a))
      : [...existing, normalized];
    const next = { ...details, addresses, selectedAddressId: normalized.id, fullName: normalized.fullName, phone: normalized.phone, address: normalized.address, city: normalized.city, state: normalized.state, pincode: normalized.pincode, country: normalized.country, notes: normalized.notes };
    setDetails(next);
    writeCheckoutDetails(next);
  };

  const addNewAddress = () => {
    const next = {
      ...details,
      selectedAddressId: '',
      fullName: details.fullName || profile?.full_name || user?.user_metadata?.full_name || '',
      phone: details.phone || profile?.phone || '',
      email: details.email || user?.email || '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      notes: '',
    };
    setDetails(next);
    writeCheckoutDetails(next);
  };

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { setError('Please complete the highlighted fields.'); form.reportValidity(); return; }
    setError('');

    const problems = stockProblems(items, products);
    if (problems.length) { setError(problems[0]); return; }

    setProcessing(true);
    const f = form.elements;
    try {
      const order = await placeOrder({
        items,
        email: f.email.value.trim(),
        couponCode: coupon?.code || null,
        shipping: {
          fullName: f.fullName.value.trim(),
          phone: f.phone.value.trim(),
          address: f.address.value.trim(),
          city: f.city.value.trim(),
          state: f.state.value.trim(),
          pincode: f.pincode.value.trim(),
          country: f.country.value,
          notes: f.notes.value.trim(),
        },
      });
      writeCoupon(null);
      writeCheckoutDetails({ ...details, email: f.email.value.trim(), fullName: f.fullName.value.trim(), phone: f.phone.value.trim(), address: f.address.value.trim(), city: f.city.value.trim(), state: f.state.value.trim(), pincode: f.pincode.value.trim(), country: f.country.value, notes: f.notes.value.trim() });
      window.localStorage.setItem('vedara-last-order', JSON.stringify(order));
      go(`/order-success?order=${encodeURIComponent(order.order_number)}`);
    } catch (err) {
      setProcessing(false);
      setError(err.message || 'We could not place your order. Please try again.');
    }
  };

  if (authLoading) return <main className={styles.pageBody}><Container><p className={styles.muted}>Loading checkout…</p></Container></main>;
  if (!isAuthenticated) return null;
  if (!items.length) return <main className={styles.pageBody}><Container><EmptyState title="Nothing to check out yet." text="Your collection is waiting for a fragrance." action="Return to shop" href="/shop" /></Container></main>;

  return (
    <main className={styles.checkout}><Container>
      <div className={styles.checkoutHead}><p className={styles.eyebrow}>VEDARA checkout</p><h1>Complete your order.</h1></div>
      <form className={styles.checkoutLayout} onSubmit={submit} noValidate>
        <section className={styles.form}>
          <h2>Contact</h2>
          <div className={styles.formRow}>
            <label>Full name<input required name="fullName" minLength={2} autoComplete="name" value={details.fullName} onChange={(event) => { const next = { ...details, fullName: event.target.value }; setDetails(next); writeCheckoutDetails(next); }} /></label>
            <label>Phone<input required name="phone" type="tel" inputMode="tel" autoComplete="tel" value={details.phone} onChange={(event) => { const next = { ...details, phone: event.target.value }; setDetails(next); writeCheckoutDetails(next); }} /></label>
          </div>
          <label>Email<input type="email" name="email" required autoComplete="email" value={details.email} onChange={(event) => { const next = { ...details, email: event.target.value }; setDetails(next); writeCheckoutDetails(next); }} /></label>

          <h2>Shipping address</h2>
          {details.addresses?.length ? (
            <div className={styles.savedAddressList}>
              {details.addresses.map((addr) => <label className={styles.choice} key={addr.id}><input type="radio" name="savedAddress" checked={details.selectedAddressId === addr.id} onChange={() => selectAddress(addr.id)} /> {addr.address}, {addr.city}, {addr.state}, {addr.pincode}, {addr.country}</label>)}
              <button type="button" className={styles.linkButton} onClick={addNewAddress}>Add New Address</button>
            </div>
          ) : (
            <button type="button" className={styles.linkButton} onClick={addNewAddress}>Add New Address</button>
          )}
          <label>Address<input required name="address" autoComplete="street-address" value={details.address} onChange={(event) => { const next = { ...details, address: event.target.value }; setDetails(next); writeCheckoutDetails(next); }} /></label>
          <div className={styles.formRow}>
            <label>City<input required name="city" autoComplete="address-level2" value={details.city} onChange={(event) => { const next = { ...details, city: event.target.value }; setDetails(next); writeCheckoutDetails(next); }} /></label>
            <label>State<input required name="state" autoComplete="address-level1" value={details.state} onChange={(event) => { const next = { ...details, state: event.target.value }; setDetails(next); writeCheckoutDetails(next); }} /></label>
          </div>
          <div className={styles.formRow}>
            <label>Pincode<input required name="pincode" inputMode="numeric" pattern="[0-9 -]{4,10}" autoComplete="postal-code" value={details.pincode} onChange={(event) => { const next = { ...details, pincode: event.target.value }; setDetails(next); writeCheckoutDetails(next); }} /></label>
            <label>Country
              <select name="country" value={details.country} autoComplete="country-name" onChange={(event) => { const next = { ...details, country: event.target.value }; setDetails(next); writeCheckoutDetails(next); }}>
                <option>India</option>
                <option>United States</option>
                <option>United Kingdom</option>
                <option>United Arab Emirates</option>
                <option>Singapore</option>
                <option>Australia</option>
                <option>Canada</option>
              </select>
            </label>
          </div>
          <label>Order notes<textarea name="notes" rows="3" placeholder="Delivery instructions, gift message… (optional)" value={details.notes} onChange={(event) => { const next = { ...details, notes: event.target.value }; setDetails(next); writeCheckoutDetails(next); }} /></label>

          <h2>Coupon</h2>
          <div className={styles.promo}>
            <input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Promo code" aria-label="Promo code" />
            <button type="button" onClick={applyCoupon}>Apply</button>
          </div>
          {coupon && <div className={styles.appliedCoupon}><span>{coupon.code}</span><strong>−{formatPrice(totals.discount || 0)}</strong><button type="button" className={styles.linkButton} onClick={removeCoupon}>Remove Coupon</button></div>}
          {couponMsg ? <p className={coupon?.valid ? styles.formSuccess : styles.formError}>{couponMsg}</p> : null}
          {coupon?.valid && !totals.discount ? <p className={styles.muted}>Add {formatPrice((coupon.min_subtotal || 0) - subtotal)} more to use {coupon.code}.</p> : null}

          <h2>Delivery</h2>
          <label className={styles.choice}><input type="radio" name="delivery" defaultChecked /> Standard delivery · {totals.shipping ? formatPrice(totals.shipping) : 'Complimentary'}</label>
          <h2>Payment method</h2>
          <label className={styles.choice}><input type="radio" name="payment" defaultChecked /> Card payment UI · frontend demo</label>
          <p className={styles.muted}>No payment is processed in this frontend experience.</p>
          {error ? <p className={styles.formError} role="alert">{error}</p> : null}
          <Button type="submit" variant="primary" fullWidth disabled={processing}>{processing ? 'Placing your order…' : `Place order · ${formatPrice(totals.total)}`}</Button>
        </section>
        <aside className={styles.summary}>
          <h2>Order summary</h2>
          {items.map((item) => <div className={styles.orderLine} key={`${item.slug}-${item.size}`}><span>{item.name} · {item.size} × {item.quantity}</span><strong>{formatPrice(item.price * item.quantity)}</strong></div>)}
          <div><span>Subtotal</span><strong>{formatPrice(totals.subtotal)}</strong></div>
          {totals.discount ? <div><span>{coupon?.code || 'Discount'}</span><strong>−{formatPrice(totals.discount)}</strong></div> : null}
          <div><span>Shipping</span><strong>{totals.shipping ? formatPrice(totals.shipping) : 'Complimentary'}</strong></div>
          <div className={styles.total}><span>Total</span><strong>{formatPrice(totals.total)}</strong></div>
        </aside>
      </form>
    </Container></main>
  );
}

/* ========================================================= Order success */

export function OrderSuccessPage() {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get('order');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      let data = orderNumber ? await getOrderByNumber(orderNumber) : null;
      if (!data) {
        try { data = JSON.parse(window.localStorage.getItem('vedara-last-order') || 'null'); } catch { data = null; }
      }
      if (alive) { setOrder(data); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [orderNumber]);

  const lines = order?.order_items || order?.items || [];
  const itemCount = lines.reduce((n, l) => n + (l.quantity || 1), 0) || lines.length;
  const addr = order?.shipping_address || null;

  return (
    <main className={styles.pageBody}><Container>
      <div className={styles.successPage}>
        <p className={styles.eyebrow}>VEDARA order confirmation</p>
        <h1>Your essence is on its way.</h1>
        <p>Thank you{order?.customer_name ? `, ${order.customer_name.split(' ')[0]}` : ''}. A confirmation has been recorded against your account.</p>
        {loading ? <p className={styles.muted}>Loading your order…</p> : order ? (
          <>
            <div className={styles.orderReceipt}>
              <div><span>Order</span><strong>{order.order_number || order.id}</strong></div>
              <div><span>Total</span><strong>{formatPrice(order.total || 0)}</strong></div>
              <div><span>Items</span><strong>{itemCount}</strong></div>
            </div>
            {lines.length ? (
              <div className={styles.orderLines}>
                {lines.map((l, i) => (
                  <div key={i} className={styles.orderLine}>
                    <span>{l.name}{l.size ? ` · ${l.size}` : ''} × {l.quantity || 1}</span>
                    <strong>{formatPrice((l.unit_price || 0) * (l.quantity || 1))}</strong>
                  </div>
                ))}
                {order.discount ? <div className={styles.orderLine}><span>Discount</span><strong>−{formatPrice(order.discount)}</strong></div> : null}
                <div className={styles.orderLine}><span>Shipping</span><strong>{order.shipping ? formatPrice(order.shipping) : 'Complimentary'}</strong></div>
              </div>
            ) : null}
            {addr?.address ? (
              <p className={styles.muted}>
                Shipping to: {[addr.address, addr.city, addr.state, addr.pincode, addr.country].filter(Boolean).join(', ')}
              </p>
            ) : null}
          </>
        ) : <p className={styles.muted}>We couldn’t load the order details, but your order was placed.</p>}
        <Button as="a" href={order ? '/account' : '/shop'} variant="primary">{order ? 'View your orders' : 'Continue shopping'}</Button>
      </div>
    </Container></main>
  );
}

/* ================================================================= Login */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PasswordField({ name, label, autoComplete, minLength = 8 }) {
  const [show, setShow] = useState(false);
  return (
    <label className={styles.passwordLabel}>
      {label}
      <span className={styles.passwordWrap}>
        <input
          name={name}
          type={show ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          aria-pressed={show}
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow((v) => !v)}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </span>
    </label>
  );
}

export function LoginPage() {
  const { isAuthenticated, loading: authLoading, recovery, signIn, signUp, resetPassword, updatePassword, friendlyAuthError } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect') || '/';
  const resumingPurchase = redirect.startsWith('/checkout');

  // login | register | forgot | recovery
  const [mode, setMode] = useState(() => {
    const t = params.get('type');
    return t === 'recovery' ? 'recovery' : t === 'forgot' ? 'forgot' : 'login';
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { if (recovery) setMode('recovery'); }, [recovery]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && mode !== 'recovery' && !recovery) {
      flushPendingPurchase();
      go(redirect);
    }
  }, [authLoading, isAuthenticated, redirect, mode, recovery]);

  const setBusy = (v) => { setProcessing(v); if (v) { setError(''); setNotice(''); } };

  const doLogin = async (f) => {
    const email = f.email.value.trim();
    const password = f.password.value;
    if (!EMAIL_RE.test(email)) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    try {
      await signIn({ email, password });
      flushPendingPurchase();
      go(redirect);
    } catch (err) {
      setProcessing(false);
      setError(friendlyAuthError(err));
    }
  };

  const doRegister = async (f) => {
    const name = f.name.value.trim();
    const email = f.email.value.trim();
    const password = f.password.value;
    const confirm = f.confirm.value;
    if (name.length < 2) return setError('Enter your full name.');
    if (!EMAIL_RE.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use a password of at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setBusy(true);
    try {
      const { session, rateLimited } = await signUp({ email, password, name });
      if (session) {
        flushPendingPurchase();
        go(redirect);
      } else if (rateLimited) {
        setProcessing(false);
        setError('Your account was created, but the email confirmation couldn’t be sent (this project’s email sender is rate-limited). Turn OFF "Confirm email" in Supabase → Authentication → Providers → Email, then sign in.');
        setMode('login');
      } else {
        setProcessing(false);
        setNotice('Account created — check your inbox to confirm your email, then sign in. Your bag is saved.');
        setMode('login');
      }
    } catch (err) {
      setProcessing(false);
      setError(friendlyAuthError(err));
    }
  };

  const doForgot = async (f) => {
    const email = f.email.value.trim();
    if (!EMAIL_RE.test(email)) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      await resetPassword(email);
      setProcessing(false);
      setNotice('If an account exists for that email, a reset link is on its way.');
      setMode('login');
    } catch (err) {
      setProcessing(false);
      setError(friendlyAuthError(err));
    }
  };

  const doRecovery = async (f) => {
    const password = f.password.value;
    const confirm = f.confirm.value;
    if (password.length < 8) return setError('Use a password of at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setBusy(true);
    try {
      await updatePassword(password);
      setProcessing(false);
      setNotice('Password updated. You’re signed in.');
      setTimeout(() => go(redirect === '/' ? '/account' : redirect), 900);
    } catch (err) {
      setProcessing(false);
      setError(friendlyAuthError(err) || 'Could not update your password. The link may have expired.');
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (processing) return;
    setError('');
    const f = event.currentTarget.elements;
    if (mode === 'login') doLogin(f);
    else if (mode === 'register') doRegister(f);
    else if (mode === 'forgot') doForgot(f);
    else doRecovery(f);
  };

  const heading = { login: 'Sign in', register: 'Create your account', forgot: 'Reset your password', recovery: 'Set a new password' }[mode];
  const cta = { login: 'Sign in', register: 'Create account', forgot: 'Send reset link', recovery: 'Save new password' }[mode];

  return (
    <main className={styles.checkout}>
      <Container>
        <div className={styles.authPage}>
          <p className={styles.eyebrow}>VEDARA account</p>
          <h1>{heading}</h1>
          <p className={styles.muted}>
            {mode === 'recovery' ? 'Choose a new password for your VEDARA account.'
              : mode === 'forgot' ? 'We’ll email you a secure link to set a new password.'
              : resumingPurchase ? 'Sign in to complete your purchase — your selected fragrance is saved and waiting in your bag.'
              : 'Access your wishlist, bag and orders across the VEDARA world.'}
          </p>

          <form className={styles.form} onSubmit={submit} noValidate>
            {mode === 'register' ? (
              <label>Full name<input name="name" required minLength={2} autoComplete="name" /></label>
            ) : null}
            {mode !== 'recovery' ? (
              <label>Email<input name="email" type="email" required autoComplete="email" /></label>
            ) : null}
            {(mode === 'login' || mode === 'register') ? (
              <PasswordField
                name="password"
                label="Password"
                minLength={mode === 'register' ? 8 : 1}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            ) : null}
            {mode === 'recovery' ? (
              <PasswordField name="password" label="New password" minLength={8} autoComplete="new-password" />
            ) : null}
            {(mode === 'register' || mode === 'recovery') ? (
              <PasswordField name="confirm" label="Confirm password" minLength={8} autoComplete="new-password" />
            ) : null}

            {mode === 'login' ? (
              <button type="button" className={styles.forgotLink} onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}>
                Forgot your password?
              </button>
            ) : null}

            {error ? <p className={styles.formError} role="alert">{error}</p> : null}
            {notice ? <p className={styles.formSuccess} role="status">{notice}</p> : null}

            <Button type="submit" variant="primary" fullWidth disabled={processing}>
              {processing ? 'One moment…' : cta}
            </Button>
          </form>

          {mode === 'login' ? (
            <p className={styles.authSwitch}>
              New to VEDARA? <button type="button" onClick={() => { setMode('register'); setError(''); setNotice(''); }}>Create an account</button>
            </p>
          ) : null}
          {mode === 'register' ? (
            <p className={styles.authSwitch}>
              Already have an account? <button type="button" onClick={() => { setMode('login'); setError(''); setNotice(''); }}>Sign in instead</button>
            </p>
          ) : null}
          {mode === 'forgot' ? (
            <p className={styles.authSwitch}>
              <button type="button" onClick={() => { setMode('login'); setError(''); setNotice(''); }}>← Back to sign in</button>
            </p>
          ) : null}
          {mode !== 'recovery' ? (
            <p className={styles.authSwitch}>
              <button type="button" onClick={() => window.history.back()}>← Return without signing in</button>
            </p>
          ) : null}
        </div>
      </Container>
    </main>
  );
}

/* =============================================================== Account */

export function AccountPage() {
  const { user, profile, loading: authLoading, isAuthenticated, signOut, updateProfile } = useAuth();
  const [orders, setOrders] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) go('/login?redirect=/account');
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) getMyOrders().then(setOrders);
  }, [isAuthenticated]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSavedMsg('');
    try {
      await updateProfile({
        full_name: event.currentTarget.elements.full_name.value,
        phone: event.currentTarget.elements.phone.value,
      });
      setSavedMsg('Saved.');
    } catch {
      setSavedMsg('Could not save — please try again.');
    }
    setSaving(false);
  };

  if (authLoading || !isAuthenticated) return null;

  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0];

  return (
    <>
      <PageHero eyebrow="Your VEDARA" title={`Hello, ${name}`} intro="Manage your VEDARA world — your details, your saved fragrances and your orders." image="/images/lifestyle.jpg" />
      <main className={styles.pageBody}><Container>
        <div className={styles.accountGrid}>
          <div className={styles.accountCard}>
            <p className={styles.eyebrow}>Signed in as</p>
            <h2>{user?.email}</h2>
            <form className={styles.profileForm} onSubmit={saveProfile}>
              <label>Full name<input name="full_name" defaultValue={profile?.full_name || ''} autoComplete="name" /></label>
              <label>Phone<input name="phone" type="tel" defaultValue={profile?.phone || ''} autoComplete="tel" /></label>
              <div className={styles.profileActions}>
                <Button type="submit" variant="primary" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save details'}</Button>
                {savedMsg ? <span className={styles.muted}>{savedMsg}</span> : null}
              </div>
            </form>
            <Button type="button" variant="secondary" size="sm" className={styles.signOut} onClick={async () => { await signOut(); go('/'); }}>Sign out</Button>
          </div>

          <div>
            <div className={styles.accountOrders}>
              <p className={styles.eyebrow}>Order history</p>
              {orders === null ? <p className={styles.muted}>Loading your orders…</p>
                : orders.length === 0 ? <p className={styles.muted}>No orders yet. <a href="/shop">Start shopping →</a></p>
                : <ul>{orders.map((o) => (
                  <li key={o.order_number}>
                    <a href={`/account/orders/${o.id}`}>
                      <span>{o.order_number}</span>
                      <span>{formatDate(o.created_at)}</span>
                      <span className={styles.orderStatus}>{o.status}</span>
                      <strong>{formatPrice(o.total || 0)}</strong>
                    </a>
                  </li>
                ))}</ul>}
            </div>
            <nav className={styles.accountLinks} aria-label="Account">
              <a href="/account/orders">All orders <span aria-hidden="true">→</span></a>
              <a href="/wishlist">Wishlist <span aria-hidden="true">→</span></a>
              <a href="/cart">Shopping bag <span aria-hidden="true">→</span></a>
              <a href="/shop">Continue shopping <span aria-hidden="true">→</span></a>
            </nav>
          </div>
        </div>
      </Container></main>
    </>
  );
}
