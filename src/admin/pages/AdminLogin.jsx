import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyProfile } from '../../lib/profile';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { Spinner } from '../components/ui';
import s from '../admin.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Dedicated owner sign-in. Authenticates through Supabase Auth, then confirms
 * the account carries the admin role (profiles.is_admin, enforced server-side
 * by vedara_is_admin() in every RLS policy). A non-admin is signed straight
 * back out. No password is ever stored by this code.
 */
export default function AdminLogin() {
  const { user, profile, loading, signIn, signOut, refreshProfile } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const dest = location.state?.from && location.state.from !== '/login' ? location.state.from : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  // Wait for the session to hydrate before deciding what to show.
  if (loading) {
    return <div className={s.authWrap}><Spinner label="Loading…" /></div>;
  }

  // Already signed in as an admin — skip the form.
  if (user && profile?.is_admin) {
    return <Navigate to={dest} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!isSupabaseConfigured) { setError('Authentication is not configured for this site.'); return; }
    if (!EMAIL_RE.test(email.trim())) { setError('Invalid Admin ID or Password'); return; }
    if (!password) { setError('Invalid Admin ID or Password'); return; }

    setBusy(true);
    try {
      await signIn({ email: email.trim(), password });
      // Verify the admin role before letting anyone through.
      const prof = await getMyProfile();
      if (!prof?.is_admin) {
        await signOut();
        setError('This account does not have admin access.');
        return;
      }
      await refreshProfile();
      nav(dest, { replace: true });
    } catch (err) {
      const m = err?.message || '';
      if (/invalid login credentials/i.test(m) || /invalid.*email/i.test(m)) {
        setError('Invalid Admin ID or Password');
      } else if (/email not confirmed/i.test(m)) {
        setError('This account has not been confirmed yet.');
      } else {
        setError(m || 'Could not sign in. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.authWrap}>
      <form className={s.authCard} onSubmit={onSubmit} noValidate>
        <div className={s.authBrand}>
          <div className={s.mark}>VEDARA</div>
          <div className={s.tag}>Owner Panel</div>
        </div>

        {error ? <p className={s.errorBox} role="alert" style={{ marginBottom: '1rem' }}>{error}</p> : null}

        <div className={s.form}>
          <div className={s.field}>
            <label htmlFor="admin-email" className={s.fieldLabel}>Admin ID</label>
            <input
              id="admin-email"
              ref={emailRef}
              className={s.input}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={busy}
              required
            />
          </div>

          <div className={s.field}>
            <label htmlFor="admin-password" className={s.fieldLabel}>Password</label>
            <div className={s.pwWrap}>
              <input
                id="admin-password"
                className={s.input}
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                required
              />
              <button
                type="button"
                className={s.pwToggle}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        <p className={s.authFoot}>
          <a href="/">← Back to store</a>
        </p>
      </form>
    </div>
  );
}
