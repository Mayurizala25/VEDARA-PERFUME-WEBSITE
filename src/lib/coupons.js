/**
 * VEDARA — coupon validation. Uses the `validate_coupon` RPC so codes stay
 * private (the coupons table is admin-only). Falls back to the built-in
 * VEDARA10 code if the RPC is not present yet.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';

const FALLBACK = {
  VEDARA10: { discount_type: 'percent', discount_value: 10, description: '10% off your order', min_subtotal: 0 },
};

/**
 * @returns {{ valid:boolean, message?:string, code?:string,
 *             discount_type?:string, discount_value?:number, min_subtotal?:number }}
 */
export async function validateCoupon(code) {
  const clean = String(code || '').trim();
  if (!clean) return { valid: false, message: 'Enter a promo code.' };

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('validate_coupon', { p_code: clean });
    if (!error && data) return data;
    // PGRST202 = RPC not created yet → fall through to the local check.
    if (error && error.code !== 'PGRST202') {
      return { valid: false, message: 'Could not check that code — try again.' };
    }
  }

  const hit = FALLBACK[clean.toUpperCase()];
  return hit
    ? { valid: true, code: clean.toUpperCase(), ...hit }
    : { valid: false, message: 'That code is not recognised.' };
}
