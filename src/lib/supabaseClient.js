/**
 * VEDARA — Supabase client.
 *
 * A single shared client for the whole app. It is created only when both
 * environment variables are present, so the storefront still runs on the
 * bundled demo catalogue when Supabase has not been configured yet.
 *
 * Only the publishable / anon key is used here — it is safe for the browser
 * because Row Level Security governs every table. The service_role key must
 * never appear in this project.
 *
 *   VITE_SUPABASE_URL              — Project Settings → API → Project URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY  — Project Settings → API → anon / publishable key
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';

/** True when the app has real Supabase credentials to talk to. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // Informational only — not an error. The site works fine without it.
  console.info(
    '[VEDARA] Supabase not configured — using the local demo catalogue. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local to connect.',
  );
}

/**
 * The shared client, or `null` when unconfigured. Callers must guard on
 * `isSupabaseConfigured` (or a null check) before use — see `lib/catalog.js`.
 */
export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        // Ready for the upcoming Supabase Auth login/admin flow.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'vedara-auth-session',
      },
    })
  : null;
