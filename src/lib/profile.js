/**
 * VEDARA — profile service. One row per user in `public.profiles`
 * (auto-created by the `vedara_handle_new_user` trigger on sign-up).
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getCurrentUser } from './auth';

/** The current user's profile row, or null. */
export async function getMyProfile() {
  if (!isSupabaseConfigured) return null;
  const user = getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, is_admin, created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;

  // The trigger normally creates this; self-heal if it's somehow missing.
  if (!data) {
    const seed = {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || null,
    };
    const { data: created, error: upsertError } = await supabase
      .from('profiles').upsert(seed).select().maybeSingle();
    if (upsertError) throw upsertError;
    return created;
  }
  return data;
}

/** Patch the current user's profile (full_name / phone). */
export async function updateMyProfile(patch) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const user = getCurrentUser();
  if (!user) throw new Error('Not signed in.');

  const clean = {};
  if (patch.full_name !== undefined) clean.full_name = patch.full_name?.trim() || null;
  if (patch.phone !== undefined) clean.phone = patch.phone?.trim() || null;

  const { data, error } = await supabase
    .from('profiles')
    .update(clean)
    .eq('id', user.id)
    .select('id, full_name, email, phone, is_admin, created_at')
    .maybeSingle();
  if (error) throw error;
  return data;
}
