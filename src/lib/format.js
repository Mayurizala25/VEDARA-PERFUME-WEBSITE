/** Format a whole-rupee amount, e.g. 6800 -> "₹6,800". */
export function formatPrice(value) {
  return `₹${(Number(value) || 0).toLocaleString('en-IN')}`;
}

/** Whole-number discount percentage, or 0 when there is no genuine markdown. */
export function discountPercent(price, originalPrice) {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

/** Human date, e.g. "9 Sep 2026". Accepts an ISO string or Date. */
export function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
