# VEDARA — Supabase

Database foundation for the storefront and the future Admin Dashboard.

## Files

| File                                    | Purpose                                                                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **`setup.sql`**                         | **Step 1, one paste** — schema + RLS + seed data.                                                                                      |
| **`migrations/0002_commerce.sql`**      | **Step 2** — `contact_enquiries` table, `validate_coupon()` + `place_order()` RPCs.                                                    |
| **`migrations/0003_forms.sql`**         | **Step 3** — extra order fields (name/phone/notes), contact fields (phone/subject), `newsletter_subscribers`, updated `place_order()`. |
| `migrations/0004_admin.sql`             | **Step 4** — owner dashboard RPCs, storage policies, and admin order status workflow.                                                  |
| `migrations/0005_order_workflows.sql`   | **Step 5** — ownership-checked customer order cancellation with stock restoration.                                                     |
| `migrations/0006_admin_data_access.sql` | **Step 6** — authenticated Data API grants for admin CRUD and enquiry deletion policy.                                                 |
| `migrations/0001_initial_schema.sql`    | Same as `setup.sql` minus the seed (for `supabase db push` / CI).                                                                      |
| `seed.sql`                              | Just the demo catalogue (12 products, images, variants, inventory, `VEDARA10` coupon).                                                 |

## One-time setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste all of **`setup.sql`** → **Run**.
3. **SQL Editor → New query** → paste all of **`migrations/0002_commerce.sql`** → **Run**.
4. **SQL Editor → New query** → paste all of **`migrations/0003_forms.sql`** → **Run**.
5. **SQL Editor → New query** → paste all of **`migrations/0004_admin.sql`** → **Run**.
6. **SQL Editor → New query** → paste all of **`migrations/0005_order_workflows.sql`** → **Run**.
7. **SQL Editor → New query** → paste all of **`migrations/0006_admin_data_access.sql`** → **Run**.
8. **Authentication → Providers → Email** — enable it. For the smoothest demo, turn **"Confirm email" OFF** so new sign-ups get a session immediately (otherwise new users must click an email link before the "Buy Now → Login → Checkout" auto-continue can finish). Optionally wire custom SMTP — the default sender caps at a few emails/hour.
9. **Project Settings → API** → copy the **Project URL** and the **anon / publishable** key into the app's `.env.local`:

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon-or-publishable-key>
   ```

10. Restart `npm run dev`. The storefront now reads products from Supabase; with no keys it falls back to the bundled demo catalogue.

## What runs against the database

| Area                                                  | Table / RPC                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Catalogue, categories, images, stock                  | `products`, `categories`, `product_images` (public read)                               |
| Sign in / up / out, session                           | Supabase Auth + `profiles` (auto-created by the `vedara_on_auth_user_created` trigger) |
| Wishlist (per user)                                   | `wishlist`                                                                             |
| Cart (per user, merged from the guest bag on sign-in) | `cart_items`                                                                           |
| Checkout                                              | `place_order()` RPC → `orders` + `order_items` (+ stock decrement, cart clear)         |
| Coupons                                               | `validate_coupon()` RPC (codes stay private)                                           |
| Product reviews                                       | `reviews` (public reads approved; users write their own, pending moderation)           |
| Contact form                                          | `contact_enquiries`                                                                    |

Guests keep a local cart/wishlist in `localStorage`; it is pushed to their account the first time they sign in and never lost on refresh.

## Making yourself an admin (for the future dashboard)

After signing up through Supabase Auth:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

`public.vedara_is_admin()` then unlocks full read/write on every table for that user.

> This project is shared with another app, so all shared objects are namespaced:
> enums `vedara_gender` / `vedara_product_status` / `vedara_order_status`,
> functions `vedara_is_admin()` / `vedara_set_updated_at()` / `vedara_handle_new_user()`,
> and the auth trigger `vedara_on_auth_user_created`. Nothing from the other app is dropped.

## Security

- Only the **anon / publishable** key is used in the browser. **Never** add the `service_role` key to this repo — it bypasses RLS.
- RLS is enabled on every table. Public visitors can read only `status = 'active'` products (plus categories, images, variants, approved reviews). Authenticated users can touch only their own `profiles` / `wishlist` / `cart_items` / `orders` / `reviews` rows. Everything else is admin-only.
- `.env.local` is git-ignored; `.env.example` is the committed template.
