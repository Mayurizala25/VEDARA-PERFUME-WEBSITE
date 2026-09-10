/**
 * VEDARA — authentication service (Supabase Auth).
 *
 * The single source of truth for auth state. Supabase persists the session in
 * localStorage (`vedara-auth-session`); this module keeps a synchronous mirror
 * of the current user so non-async callers (Header, route guards) can read it
 * immediately, and broadcasts `vedara:auth-change` whenever it changes.
 *
 * Only the publishable/anon key is ever used — never the service_role key.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';

let cachedUser = null;
let recoveryMode = false;
let initialised = false;
let readyResolve;
const readyPromise = new Promise((resolve) => { readyResolve = resolve; });

const MEANINGFUL = new Set(['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'PASSWORD_RECOVERY']);

function setUser(nextUser, event) {
  const changed = (cachedUser?.id || null) !== (nextUser?.id || null);
  cachedUser = nextUser || null;
  if (event === 'PASSWORD_RECOVERY') recoveryMode = true;
  if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') recoveryMode = false;
  if (changed || MEANINGFUL.has(event)) {
    window.dispatchEvent(new CustomEvent('vedara:auth-change', {
      detail: { event, user: cachedUser, recovery: recoveryMode },
    }));
  }
}

/** True while the user arrived via a password-reset link. */
export function isRecovery() {
  return recoveryMode;
}
export function clearRecovery() {
  recoveryMode = false;
}

/** Hydrate the session once and subscribe to changes. Safe to call repeatedly. */
export function initAuth() {
  if (initialised) return readyPromise;
  initialised = true;

  if (!isSupabaseConfigured) {
    readyResolve();
    return readyPromise;
  }

  supabase.auth.getSession()
    .then(({ data }) => setUser(data.session?.user || null))
    .catch(() => setUser(null))
    .finally(() => readyResolve());

  supabase.auth.onAuthStateChange((event, session) => {
    setUser(session?.user || null, event);
  });

  return readyPromise;
}

/** Resolves once the initial session has been loaded. */
export function authReady() {
  return readyPromise;
}

/** The signed-in user (Supabase user object), or null. Synchronous best-effort. */
export function getCurrentUser() {
  return cachedUser;
}

export function isAuthenticated() {
  return Boolean(cachedUser);
}

/** Display name derived from metadata or the email local-part. */
export function displayName(user = cachedUser) {
  if (!user) return '';
  return (
    user.user_metadata?.full_name?.trim()
    || user.email?.split('@')[0]
    || 'VEDARA member'
  );
}

export async function signIn({ email, password }) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || '').trim(),
    password: String(password || ''),
  });
  if (error) throw error;
  setUser(data.user, 'SIGNED_IN');
  return data.user;
}

export async function signUp({ email, password, name }) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const cleanEmail = String(email || '').trim();
  const cleanPassword = String(password || '');
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: cleanPassword,
    options: { data: { full_name: (name || '').trim() || undefined } },
  });

  // "Confirm email" is on AND the built-in mailer is rate-limited: the account
  // is still created, so fall back to signing straight in (works when the
  // project has confirmation disabled or SMTP configured).
  if (error) {
    if (isRateLimit(error)) {
      try {
        const signedIn = await signIn({ email: cleanEmail, password: cleanPassword });
        return { user: signedIn, session: { user: signedIn }, rateLimited: true };
      } catch {
        return { user: null, session: null, rateLimited: true };
      }
    }
    throw error;
  }

  // Confirmation off → session is returned. Confirmation on → session is null.
  if (data.session?.user) {
    setUser(data.session.user, 'SIGNED_IN');
    return { user: data.user, session: data.session };
  }

  // No session, no error. If the new user came back already confirmed the
  // project has confirmation disabled — sign straight in. Otherwise a
  // confirmation email is on its way and there's nothing more to do here.
  if (data.user?.email_confirmed_at || data.user?.confirmed_at) {
    try {
      const signedIn = await signIn({ email: cleanEmail, password: cleanPassword });
      return { user: signedIn, session: { user: signedIn } };
    } catch { /* fall through to the confirmation path */ }
  }
  return { user: data.user, session: null, needsConfirmation: true };
}

/** True for Supabase's "too many emails" throttle. */
export function isRateLimit(error) {
  return (
    error?.status === 429
    || /rate limit|too many requests|over_email_send_rate_limit/i.test(error?.message || error?.code || '')
  );
}

/** A message the (owner-)user can act on. */
export function friendlyAuthError(error) {
  const m = error?.message || '';
  if (isRateLimit(error)) {
    return 'This project’s built-in email sender is rate-limited. In Supabase → Authentication → Providers → Email, turn OFF "Confirm email" (or add custom SMTP), then try again.';
  }
  if (/email not confirmed/i.test(m)) return 'This account hasn’t been confirmed yet. Confirm it, or disable "Confirm email" in your Supabase project.';
  if (/invalid login credentials/i.test(m)) return 'That email and password don’t match.';
  if (/already registered|already exists|user already/i.test(m)) return 'That email already has an account — sign in instead.';
  if (/password should be|weak password|at least \d+ characters/i.test(m)) return 'That password is too weak — use at least 8 characters.';
  if (/unable to validate email|invalid.*email/i.test(m)) return 'That email address looks invalid to the server — try a different one.';
  return m || 'Something went wrong. Please try again.';
}

export async function signOut() {
  if (isSupabaseConfigured) {
    try { await supabase.auth.signOut(); } catch { /* ignore network errors on sign out */ }
  }
  setUser(null, 'SIGNED_OUT');
}

/** Send a password-reset email. The link returns to /login?type=recovery. */
export async function resetPassword(email) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const redirectTo = `${window.location.origin}/login?type=recovery`;
  const { error } = await supabase.auth.resetPasswordForEmail(
    String(email || '').trim(),
    { redirectTo },
  );
  if (error) throw error;
}

/** Set a new password for the signed-in (or recovery-session) user. */
export async function updatePassword(password) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.updateUser({ password: String(password || '') });
  if (error) throw error;
  if (data.user) setUser(data.user, 'USER_UPDATED');
  return data.user;
}
