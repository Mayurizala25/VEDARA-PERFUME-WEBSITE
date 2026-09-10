/**
 * VEDARA — auth context.
 *
 * Wraps the app once (see main.jsx). Hydrates the Supabase session, exposes
 * the current user + profile row, and keeps them in sync via the
 * `vedara:auth-change` event that `lib/auth.js` broadcasts.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  authReady,
  clearRecovery,
  displayName,
  friendlyAuthError,
  getCurrentUser,
  initAuth,
  isAuthenticated,
  isRecovery,
  resetPassword as svcResetPassword,
  signIn as svcSignIn,
  signOut as svcSignOut,
  signUp as svcSignUp,
  updatePassword as svcUpdatePassword,
} from '../lib/auth';
import { getMyProfile, updateMyProfile } from '../lib/profile';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser());
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(() => isRecovery());

  const loadProfile = useCallback(async (u) => {
    if (!u) { setProfile(null); return; }
    try { setProfile(await getMyProfile()); } catch { setProfile(null); }
  }, []);

  useEffect(() => {
    let alive = true;
    initAuth();
    authReady().then(async () => {
      if (!alive) return;
      const u = getCurrentUser();
      setUser(u);
      await loadProfile(u);
      setLoading(false);
    });

    const onChange = (event) => {
      if (!alive) return;
      const u = event.detail?.user ?? getCurrentUser();
      setUser(u);
      setRecovery(isRecovery());
      setLoading(true);
      loadProfile(u).finally(() => { if (alive) setLoading(false); });
    };
    window.addEventListener('vedara:auth-change', onChange);
    return () => { alive = false; window.removeEventListener('vedara:auth-change', onChange); };
  }, [loadProfile]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    recovery,
    isAuthenticated: Boolean(user),
    name: displayName(user),
    signIn: svcSignIn,
    signUp: svcSignUp,
    signOut: svcSignOut,
    resetPassword: svcResetPassword,
    friendlyAuthError,
    updatePassword: async (pw) => { const u = await svcUpdatePassword(pw); clearRecovery(); setRecovery(false); return u; },
    refreshProfile: () => loadProfile(getCurrentUser()),
    updateProfile: async (patch) => {
      const updated = await updateMyProfile(patch);
      setProfile(updated);
      return updated;
    },
  }), [user, profile, loading, recovery, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Defensive: allow use outside a provider (e.g. isolated tests) without crashing.
    return {
      user: null, profile: null, loading: false, recovery: false, isAuthenticated: isAuthenticated(),
      name: '', signIn: svcSignIn, signUp: svcSignUp, signOut: svcSignOut,
      resetPassword: svcResetPassword, updatePassword: svcUpdatePassword, friendlyAuthError,
      refreshProfile: () => {}, updateProfile: async () => null,
    };
  }
  return ctx;
}
