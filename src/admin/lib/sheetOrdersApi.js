/**
 * VEDARA admin — client for the Google Sheets sync of Supabase orders.
 *
 * Talks only to the serverless `/api/sheet-orders` endpoint — never to
 * Google directly, so the service-account credentials never reach the
 * browser. Every call carries the signed-in admin's Supabase access token;
 * the endpoint re-verifies `profile.is_admin` itself, the same rule
 * AdminGuard enforces client-side. Supabase order data is read/written
 * directly via `adminApi.js` (RLS-scoped, no service-role key) — this file
 * only drives the Sheet side of the sync.
 */
import { supabase } from '../../lib/supabaseClient';

async function authHeaders() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session has expired — please sign in again.');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

async function post(op, id) {
  const headers = await authHeaders();
  const qs = new URLSearchParams({ op, ...(id ? { id } : {}) });
  let res;
  try {
    res = await fetch(`/api/sheet-orders?${qs}`, { method: 'POST', headers });
  } catch {
    throw new Error('Could not reach the server — check your connection and try again.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || `Request failed (HTTP ${res.status}). The server did not return a readable error.`);
  }
  return json;
}

/** Push every Supabase order into the Google Sheet — upserts by `id`. */
export function syncOrdersToSheet() {
  return post('sync');
}

/** Read the Google Sheet and update matching Supabase orders by `id`. */
export function pullOrdersFromSheet() {
  return post('pull');
}

/** Re-mirror one order (fresh from Supabase) into its Sheet row. */
export function mirrorOrderToSheet(id) {
  return post('mirror', id);
}
