import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Rating from '../ui/Rating';
import { useAuth } from '../../context/AuthContext';
import { getReviews, submitReview } from '../../lib/reviews';
import { formatDate } from '../../lib/format';
import styles from './ProductReviews.module.css';

/** Reviews for a product — public list + a form for signed-in customers. */
export default function ProductReviews({ productId, productName, fallbackCount = 0 }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState({ reviews: [], count: 0, average: 0, mine: null, loading: true });
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    if (!productId) { setState((s) => ({ ...s, loading: false })); return; }
    getReviews(productId).then((r) => setState({ ...r, loading: false }));
  };

  useEffect(load, [productId]);

  useEffect(() => {
    if (state.mine) { setRating(state.mine.rating); }
  }, [state.mine]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    try {
      await submitReview({
        productId,
        rating,
        title: form.elements.title.value,
        body: form.elements.body.value,
      });
      setStatus('Thank you — your review has been submitted for moderation.');
      form.reset();
      setRating(5);
      load();
    } catch (err) {
      setError(err.message || 'Could not submit your review.');
    }
  };

  return (
    <section className={styles.section} aria-labelledby="reviews-heading">
      <div className={styles.head}>
        <p className={styles.eyebrow}>Customer Reviews</p>
        <h2 id="reviews-heading">What people say about {productName}</h2>
        {state.count > 0 ? (
          <p className={styles.summary}>
            <Rating value={Math.round(state.average)} />
            <span>{state.average.toFixed(1)} · {state.count} {state.count === 1 ? 'review' : 'reviews'}</span>
          </p>
        ) : (
          <p className={styles.summary}>
            <span>{state.loading ? 'Loading reviews…' : 'No reviews yet — be the first.'}</span>
          </p>
        )}
      </div>

      {state.reviews.length > 0 ? (
        <ul className={styles.list}>
          {state.reviews.map((r) => (
            <li key={r.id} className={styles.review}>
              <Rating value={r.rating} />
              {r.title ? <p className={styles.reviewTitle}>{r.title}</p> : null}
              {r.body ? <p className={styles.reviewBody}>{r.body}</p> : null}
              <p className={styles.reviewMeta}>{formatDate(r.created_at)}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {isAuthenticated ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.formTitle}>{state.mine ? 'Update your review' : 'Write a review'}</p>
          <div className={styles.stars} role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                data-on={n <= rating || undefined}
                onClick={() => setRating(n)}
              >
                ★
              </button>
            ))}
          </div>
          <label>Title<input name="title" maxLength={120} defaultValue={state.mine?.title || ''} /></label>
          <label>Review<textarea name="body" rows="4" maxLength={1000} defaultValue={state.mine?.body || ''} /></label>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {status ? <p className={styles.success} role="status">{status}</p> : null}
          <Button type="submit" variant="primary" size="sm">
            {state.mine ? 'Update review' : 'Submit review'}
          </Button>
        </form>
      ) : (
        <p className={styles.signin}>
          <a href={`/login?redirect=${encodeURIComponent(window.location.pathname)}`}>Sign in</a> to leave a review.
        </p>
      )}
    </section>
  );
}
