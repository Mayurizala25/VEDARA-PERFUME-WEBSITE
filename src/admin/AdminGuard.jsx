import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Spinner } from './components/ui';
import s from './admin.module.css';

/**
 * Gate for every /admin route. RLS enforces access server-side regardless;
 * this is the UX layer. Requires a signed-in user whose profile.is_admin.
 */
export default function AdminGuard() {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className={s.app}><Spinner label="Checking access…" /></div>;
  }

  // Not signed in → dedicated admin login, remembering where they were headed.
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Signed in but not an owner → deny, offer to sign in as someone else.
  if (!profile?.is_admin) {
    return (
      <div className={s.app}>
        <div className={s.center} style={{ minHeight: '100dvh' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', color: 'var(--admin-ink)' }}>
            Not authorised
          </h2>
          <p style={{ maxWidth: '24rem' }}>
            This account ({user.email}) isn’t a VEDARA owner. Ask an existing admin to grant you
            access, then reload.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Button variant="ghost" onClick={() => { window.location.href = '/'; }}>Back to store</Button>
            <Button variant="primary" onClick={async () => { await signOut(); }}>
              Sign in as someone else
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
