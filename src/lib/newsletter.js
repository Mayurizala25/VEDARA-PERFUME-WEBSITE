/**
 * VEDARA — newsletter sign-ups. Saved to `public.newsletter_subscribers`
 * (anyone may insert; unique on email; only admins can read).
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';

export async function subscribeToNewsletter(email, source = 'homepage') {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return { ok: false, message: 'Enter your email address.' };

  if (!isSupabaseConfigured) return { ok: true, stored: false };

  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email: clean, source });

  if (!error) return { ok: true, stored: true };
  if (error.code === '23505') return { ok: true, stored: true, already: true }; // already subscribed
  if (error.code === 'PGRST205' || error.code === '42P01') {
    console.warn('[VEDARA] newsletter_subscribers missing — sign-up not stored. Run migration 0003.');
    return { ok: true, stored: false };
  }
  console.error('[VEDARA] newsletter sign-up failed:', error.code, error.message);
  return { ok: false, message: 'Something went wrong — please try again.' };
}
