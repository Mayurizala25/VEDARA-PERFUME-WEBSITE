/**
 * VEDARA — product reviews. Public reads approved rows; signed-in users
 * submit their own (created unapproved, pending moderation).
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getCurrentUser } from './auth';

/** Approved reviews for a product + a summary. */
export async function getReviews(productId) {
  if (!isSupabaseConfigured || !productId) {
    return { reviews: [], count: 0, average: 0, mine: null };
  }
  const user = getCurrentUser();
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, title, body, created_at, user_id, is_approved')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[VEDARA] getReviews:', error.message);
    return { reviews: [], count: 0, average: 0, mine: null };
  }

  const approved = (data || []).filter((r) => r.is_approved);
  const mine = user ? (data || []).find((r) => r.user_id === user.id) || null : null;
  const count = approved.length;
  const average = count ? approved.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { reviews: approved, count, average, mine };
}

/**
 * A handful of the most recent approved reviews across the whole catalogue,
 * for the homepage testimonial rail. Returns [] when there are none yet.
 */
export async function getRecentReviews(limit = 8) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, title, body, created_at, products(name)')
    .eq('is_approved', true)
    .not('body', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.warn('[VEDARA] getRecentReviews:', error.message); return []; }
  return (data || []).map((r) => ({
    id: r.id,
    rating: r.rating,
    quote: r.body,
    title: r.title,
    product: r.products?.name || 'VEDARA',
    name: 'A VEDARA customer',
  }));
}

/** Create or update the current user's review for a product. */
export async function submitReview({ productId, rating, title, body }) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const user = getCurrentUser();
  if (!user) throw new Error('Please sign in to leave a review.');

  const payload = {
    product_id: productId,
    user_id: user.id,
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    title: title?.trim() || null,
    body: body?.trim() || null,
    is_approved: false,
  };

  const { error } = await supabase
    .from('reviews')
    .upsert(payload, { onConflict: 'product_id,user_id' });
  if (error) throw error;
  return { pending: true };
}
