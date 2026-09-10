/**
 * VEDARA — contact enquiries. Saved to `public.contact_enquiries`
 * (anyone may insert; only admins can read).
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getCurrentUser } from './auth';

export async function submitEnquiry({ name, email, phone, subject, message }) {
  if (!isSupabaseConfigured) {
    return { ok: true, stored: false };
  }
  const user = getCurrentUser();
  const { error } = await supabase.from('contact_enquiries').insert({
    user_id: user?.id ?? null,
    name: name?.trim(),
    email: email?.trim(),
    phone: phone?.trim() || null,
    subject: subject?.trim() || null,
    topic: subject?.trim() || null, // keep the legacy column populated too
    message: message?.trim(),
  });

  if (!error) return { ok: true, stored: true };

  // Table genuinely not created yet — don't make the customer retry.
  if (error.code === 'PGRST205' || error.code === '42P01') {
    console.warn('[VEDARA] contact_enquiries missing — enquiry not stored. Run migrations.');
    return { ok: true, stored: false };
  }
  // `subject`/`phone` column missing (0003 not run) — retry without them.
  if (error.code === 'PGRST204') {
    const { error: retryError } = await supabase.from('contact_enquiries').insert({
      user_id: user?.id ?? null,
      name: name?.trim(),
      email: email?.trim(),
      topic: subject?.trim() || null,
      message: message?.trim(),
    });
    if (!retryError) return { ok: true, stored: true };
  }

  console.error('[VEDARA] contact enquiry failed:', error.code, error.message);
  return { ok: false, stored: false, error };
}
