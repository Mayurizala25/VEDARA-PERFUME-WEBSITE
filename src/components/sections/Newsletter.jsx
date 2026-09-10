import { useId, useState } from 'react';
import Section from '../layout/Section';
import Button from '../ui/Button';
import { subscribeToNewsletter } from '../../lib/newsletter';
import styles from './Newsletter.module.css';

/** Newsletter — a luxury invitation to the VEDARA list, saved to Supabase. */
export default function Newsletter() {
  const inputId = useId();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [message, setMessage] = useState('');

  const onSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!email || !form.checkValidity()) { form.reportValidity(); return; }
    setStatus('sending');
    const result = await subscribeToNewsletter(email, 'homepage');
    if (result.ok) {
      setStatus('done');
      setMessage(result.already ? 'You’re already on the list — thank you.' : 'Welcome to the VEDARA list.');
    } else {
      setStatus('error');
      setMessage(result.message || 'Something went wrong — please try again.');
    }
  };
  const done = status === 'done';

  return (
    <Section as="section" tone="dark" spacing="sm" aria-labelledby="newsletter-heading" containerClassName={styles.container}>
      <span className={styles.glow} aria-hidden="true" />
      <div className={styles.card}>
        <p className={styles.eyebrow}>By Invitation</p>
        <h2 id="newsletter-heading" className={styles.title}>
          Stay in Your Essence.
        </h2>
        <span className={styles.ornament} aria-hidden="true">
          <i /><span>&#10022;</span><i />
        </span>
        <p className={styles.text}>
          Join the VEDARA world for fragrance stories, new collections and
          private releases — a few considered notes a month, nothing more.
        </p>

        {done ? (
          <p className={styles.success} role="status">{message}</p>
        ) : (
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <label htmlFor={inputId} className="visually-hidden">Email address</label>
            <input
              id={inputId}
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="Your email address"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" variant="light" className={styles.submit} disabled={status === 'sending'}>
              {status === 'sending' ? 'Joining…' : 'Request Invitation'}
            </Button>
          </form>
        )}
        {status === 'error' ? <p className={styles.success} role="alert">{message}</p> : null}

        <p className={styles.privacy}>
          By subscribing you agree to receive VEDARA emails. Unsubscribe anytime.
        </p>
      </div>
    </Section>
  );
}
