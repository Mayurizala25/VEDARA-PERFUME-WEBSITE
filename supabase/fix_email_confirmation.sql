-- ============================================================================
-- VEDARA — fix "email rate limit exceeded" / stuck sign-ups
-- ----------------------------------------------------------------------------
-- Supabase's built-in email sender allows only a few messages per hour, so with
-- "Confirm email" ON, sign-ups queue a confirmation email that never arrives and
-- the account can't sign in.
--
-- RECOMMENDED for this demo:
--   1. Dashboard → Authentication → Providers → Email → turn OFF "Confirm email".
--      (New sign-ups then get a session immediately — no email involved.)
--   2. Run the statement below ONCE to confirm the accounts that are already
--      stuck, so they can sign in too.
--
-- (If you'd rather keep confirmation ON for production, configure custom SMTP
--  under Authentication → Emails → SMTP Settings instead — Resend, SendGrid, etc.)
-- ============================================================================

-- Confirm every currently-unconfirmed user. `confirmed_at` is a generated
-- column, so setting email_confirmed_at is enough.
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;

-- Grant the owner account access to the VEDARA admin panel. The upsert also
-- repairs an account whose profile trigger did not create its row.
insert into public.profiles (id, email, full_name, is_admin)
select id, email, raw_user_meta_data ->> 'full_name', true
from auth.users
where lower(email) = lower('adminsite@gmail.com')
on conflict (id) do update set is_admin = true;

-- Check:
--   select email, email_confirmed_at from auth.users order by created_at desc;

-- Check:
--   select email, is_admin from public.profiles
--   where lower(email) = lower('adminsite@gmail.com');
