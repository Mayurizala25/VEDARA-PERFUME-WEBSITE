/**
 * VEDARA — cart & wishlist hooks.
 *
 * Thin reactive wrappers over `lib/commerce.js`: they re-render on the
 * `vedara:cart-change` / `vedara:wishlist-change` events the service emits
 * (fired for local edits, server pulls and sign-in merges alike).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  addCartItem,
  cartCount,
  cartSubtotal,
  clearCart,
  isWishlisted,
  readCart,
  readWishlist,
  removeCartItem,
  toggleWishlist,
  updateCartItem,
} from '../lib/commerce';

function useEvent(name, read) {
  const [value, setValue] = useState(read);
  useEffect(() => {
    const sync = () => setValue(read());
    sync();
    window.addEventListener(name, sync);
    return () => window.removeEventListener(name, sync);
  }, [name, read]);
  return value;
}

export function useCart() {
  const items = useEvent('vedara:cart-change', readCart);
  return {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: items.reduce((n, i) => n + i.price * i.quantity, 0),
    add: addCartItem,
    update: updateCartItem,
    remove: removeCartItem,
    clear: clearCart,
  };
}

export function useCartCount() {
  return useEvent('vedara:cart-change', cartCount);
}

export function useWishlist() {
  const slugs = useEvent('vedara:wishlist-change', readWishlist);
  const has = useCallback((slug) => slugs.includes(slug), [slugs]);
  return { slugs, count: slugs.length, has, toggle: toggleWishlist };
}

export { cartSubtotal, isWishlisted };
