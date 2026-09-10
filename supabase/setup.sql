-- ============================================================================
-- VEDARA — one-shot Supabase setup   (schema + RLS + seed data)
-- ----------------------------------------------------------------------------
-- Paste this whole file into  Supabase Dashboard → SQL Editor → New query → Run.
--
-- It is the concatenation of:
--   supabase/migrations/0001_initial_schema.sql   (structure + Row Level Security)
--   supabase/seed.sql                             (the 12 demo fragrances)
--
-- Safe to run more than once — everything is guarded with IF NOT EXISTS /
-- CREATE OR REPLACE / DROP ... IF EXISTS / ON CONFLICT / WHERE NOT EXISTS.
--
-- SHARED-PROJECT SAFE: this project also hosts another app. Every object in a
-- shared namespace (enums, helper functions, the auth.users trigger) is
-- prefixed `vedara_`; nothing belonging to another app is dropped or altered.
-- ============================================================================


-- ##########################################################################
-- ## PART 1 — SCHEMA, TRIGGERS, ROW LEVEL SECURITY
-- ##########################################################################

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type vedara_gender as enum ('Men', 'Women', 'Unisex');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vedara_product_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vedara_order_status as enum ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Maintain updated_at on UPDATE.
create or replace function public.vedara_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ===========================================================================
-- profiles  (1:1 with auth.users — Supabase Auth foundation)
-- ===========================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.vedara_set_updated_at();

-- True when the current user is a VEDARA admin. SECURITY DEFINER so it can
-- read profiles without tripping that table's own RLS (no recursion).
-- Defined after public.profiles because a LANGUAGE SQL body is validated at
-- creation time and would fail if the table did not exist yet.
create or replace function public.vedara_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Create a profile row automatically for every new auth user. Uniquely named
-- so it coexists with any auth trigger another app in this project may have.
create or replace function public.vedara_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists vedara_on_auth_user_created on auth.users;
create trigger vedara_on_auth_user_created
  after insert on auth.users
  for each row execute function public.vedara_handle_new_user();

-- ===========================================================================
-- categories  (fragrance families)
-- ===========================================================================
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_categories_updated on public.categories;
create trigger trg_categories_updated before update on public.categories
  for each row execute function public.vedara_set_updated_at();

-- ===========================================================================
-- products
-- ===========================================================================
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  description       text,
  short_description text,
  price             numeric(10, 2) not null check (price >= 0),
  original_price    numeric(10, 2) check (original_price >= 0),
  category_id       uuid references public.categories (id) on delete set null,
  gender            vedara_gender,
  fragrance_type    text,                 -- Eau de Parfum | Parfum | Eau de Toilette
  family            text,                 -- display label, e.g. "Oud · Woody"
  top_notes         text,
  heart_notes       text,
  base_notes        text,
  sizes             text[] not null default '{}',   -- e.g. {30ml,50ml,100ml}
  stock             integer not null default 0 check (stock >= 0),
  sku               text unique,
  featured          boolean not null default false,
  best_seller       boolean not null default false,
  new_arrival       boolean not null default false,
  status            vedara_product_status not null default 'draft',
  rating            numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count      integer not null default 0 check (review_count >= 0),
  tone              text,                 -- placeholder tint for the UI
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_products_status   on public.products (status);
create index if not exists idx_products_category  on public.products (category_id);
create index if not exists idx_products_gender    on public.products (gender);
create index if not exists idx_products_flags     on public.products (featured, best_seller, new_arrival);

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated before update on public.products
  for each row execute function public.vedara_set_updated_at();

-- ===========================================================================
-- product_images
-- ===========================================================================
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  url         text not null,
  alt         text,
  sort_order  integer not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_product_images_product on public.product_images (product_id);

drop trigger if exists trg_product_images_updated on public.product_images;
create trigger trg_product_images_updated before update on public.product_images
  for each row execute function public.vedara_set_updated_at();

-- ===========================================================================
-- product_variants  (per-size SKU / price — for the Admin Dashboard)
-- ===========================================================================
create table if not exists public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  size           text not null,                         -- 30ml | 50ml | 100ml
  sku            text unique,
  price          numeric(10, 2) check (price >= 0),      -- null => inherit product.price
  original_price numeric(10, 2) check (original_price >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (product_id, size)
);

create index if not exists idx_variants_product on public.product_variants (product_id);

drop trigger if exists trg_variants_updated on public.product_variants;
create trigger trg_variants_updated before update on public.product_variants
  for each row execute function public.vedara_set_updated_at();

-- ===========================================================================
-- inventory  (detailed stock per variant — admin only)
-- ===========================================================================
create table if not exists public.inventory (
  id                uuid primary key default gen_random_uuid(),
  variant_id        uuid not null unique references public.product_variants (id) on delete cascade,
  quantity          integer not null default 0 check (quantity >= 0),
  reserved          integer not null default 0 check (reserved >= 0),
  restock_threshold integer not null default 0 check (restock_threshold >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_inventory_updated on public.inventory;
create trigger trg_inventory_updated before update on public.inventory
  for each row execute function public.vedara_set_updated_at();

-- ===========================================================================
-- wishlist
-- ===========================================================================
create table if not exists public.wishlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists idx_wishlist_user on public.wishlist (user_id);

-- ===========================================================================
-- cart_items
-- ===========================================================================
create table if not exists public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  variant_id  uuid references public.product_variants (id) on delete set null,
  size        text,
  quantity    integer not null default 1 check (quantity > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, product_id, size)
);

create index if not exists idx_cart_user on public.cart_items (user_id);

drop trigger if exists trg_cart_updated on public.cart_items;
create trigger trg_cart_updated before update on public.cart_items
  for each row execute function public.vedara_set_updated_at();

-- ===========================================================================
-- coupons
-- ===========================================================================
create table if not exists public.coupons (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  description    text,
  discount_type  text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10, 2) not null check (discount_value >= 0),
  min_subtotal   numeric(10, 2) not null default 0 check (min_subtotal >= 0),
  active         boolean not null default true,
  starts_at      timestamptz,
  expires_at     timestamptz,
  usage_limit    integer check (usage_limit >= 0),
  times_used     integer not null default 0 check (times_used >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_coupons_updated on public.coupons;
create trigger trg_coupons_updated before update on public.coupons
  for each row execute function public.vedara_set_updated_at();

-- ===========================================================================
-- orders
-- ===========================================================================
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users (id) on delete set null,
  order_number     text not null unique default ('VD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  status           vedara_order_status not null default 'pending',
  email            text,
  subtotal         numeric(10, 2) not null default 0 check (subtotal >= 0),
  discount         numeric(10, 2) not null default 0 check (discount >= 0),
  shipping         numeric(10, 2) not null default 0 check (shipping >= 0),
  total            numeric(10, 2) not null default 0 check (total >= 0),
  coupon_id        uuid references public.coupons (id) on delete set null,
  shipping_address jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_orders_user on public.orders (user_id);

drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.vedara_set_updated_at();

-- ===========================================================================
-- order_items  (line snapshots)
-- ===========================================================================
create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  variant_id  uuid references public.product_variants (id) on delete set null,
  name        text not null,
  size        text,
  unit_price  numeric(10, 2) not null check (unit_price >= 0),
  quantity    integer not null check (quantity > 0),
  created_at  timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items (order_id);

-- ===========================================================================
-- reviews
-- ===========================================================================
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  rating      integer not null check (rating between 1 and 5),
  title       text,
  body        text,
  is_approved boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists idx_reviews_product on public.reviews (product_id);

drop trigger if exists trg_reviews_updated on public.reviews;
create trigger trg_reviews_updated before update on public.reviews
  for each row execute function public.vedara_set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.product_images    enable row level security;
alter table public.product_variants  enable row level security;
alter table public.inventory         enable row level security;
alter table public.wishlist          enable row level security;
alter table public.cart_items        enable row level security;
alter table public.coupons           enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.reviews           enable row level security;

-- profiles -----------------------------------------------------------------
drop policy if exists "vedara profiles: read own"   on public.profiles;
drop policy if exists "vedara profiles: update own" on public.profiles;
drop policy if exists "vedara profiles: insert own" on public.profiles;
drop policy if exists "vedara profiles: admin all"  on public.profiles;

create policy "vedara profiles: read own"   on public.profiles for select using (id = auth.uid());
create policy "vedara profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "vedara profiles: insert own" on public.profiles for insert with check (id = auth.uid());
create policy "vedara profiles: admin all"  on public.profiles for all using (public.vedara_is_admin()) with check (public.vedara_is_admin());

-- categories -------------------------------------------------------------
drop policy if exists "vedara categories: public read" on public.categories;
drop policy if exists "vedara categories: admin write" on public.categories;

create policy "vedara categories: public read" on public.categories for select using (true);
create policy "vedara categories: admin write" on public.categories for all using (public.vedara_is_admin()) with check (public.vedara_is_admin());

-- products --------------------------------------------------------------
drop policy if exists "vedara products: public read active" on public.products;
drop policy if exists "vedara products: admin all"          on public.products;

create policy "vedara products: public read active" on public.products
  for select using (status = 'active' or public.vedara_is_admin());
create policy "vedara products: admin all" on public.products
  for all using (public.vedara_is_admin()) with check (public.vedara_is_admin());

-- product_images / product_variants -----------------------------------
drop policy if exists "vedara product_images: public read" on public.product_images;
drop policy if exists "vedara product_images: admin all"   on public.product_images;

create policy "vedara product_images: public read" on public.product_images for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or public.vedara_is_admin()))
);
create policy "vedara product_images: admin all" on public.product_images
  for all using (public.vedara_is_admin()) with check (public.vedara_is_admin());

drop policy if exists "vedara product_variants: public read" on public.product_variants;
drop policy if exists "vedara product_variants: admin all"   on public.product_variants;

create policy "vedara product_variants: public read" on public.product_variants for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or public.vedara_is_admin()))
);
create policy "vedara product_variants: admin all" on public.product_variants
  for all using (public.vedara_is_admin()) with check (public.vedara_is_admin());

-- inventory ---------------------------------------------------------
drop policy if exists "vedara inventory: admin all" on public.inventory;
create policy "vedara inventory: admin all" on public.inventory
  for all using (public.vedara_is_admin()) with check (public.vedara_is_admin());

-- wishlist / cart_items -------------------------------------------
drop policy if exists "vedara wishlist: own" on public.wishlist;
create policy "vedara wishlist: own" on public.wishlist
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "vedara cart_items: own" on public.cart_items;
create policy "vedara cart_items: own" on public.cart_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- coupons ------------------------------------------------------
drop policy if exists "vedara coupons: admin all" on public.coupons;
create policy "vedara coupons: admin all" on public.coupons
  for all using (public.vedara_is_admin()) with check (public.vedara_is_admin());

-- orders -----------------------------------------------------
drop policy if exists "vedara orders: read own"   on public.orders;
drop policy if exists "vedara orders: insert own" on public.orders;
drop policy if exists "vedara orders: admin all"  on public.orders;

create policy "vedara orders: read own"   on public.orders for select using (user_id = auth.uid());
create policy "vedara orders: insert own" on public.orders for insert with check (user_id = auth.uid());
create policy "vedara orders: admin all"  on public.orders for all using (public.vedara_is_admin()) with check (public.vedara_is_admin());

-- order_items ----------------------------------------------
drop policy if exists "vedara order_items: read own"   on public.order_items;
drop policy if exists "vedara order_items: insert own" on public.order_items;
drop policy if exists "vedara order_items: admin all"  on public.order_items;

create policy "vedara order_items: read own" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "vedara order_items: insert own" on public.order_items for insert with check (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "vedara order_items: admin all" on public.order_items
  for all using (public.vedara_is_admin()) with check (public.vedara_is_admin());

-- reviews -------------------------------------------------
drop policy if exists "vedara reviews: read approved or own" on public.reviews;
drop policy if exists "vedara reviews: insert own"           on public.reviews;
drop policy if exists "vedara reviews: update own"           on public.reviews;
drop policy if exists "vedara reviews: delete own"           on public.reviews;
drop policy if exists "vedara reviews: admin all"            on public.reviews;

create policy "vedara reviews: read approved or own" on public.reviews
  for select using (is_approved = true or user_id = auth.uid() or public.vedara_is_admin());
create policy "vedara reviews: insert own" on public.reviews
  for insert with check (user_id = auth.uid());
create policy "vedara reviews: update own" on public.reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "vedara reviews: delete own" on public.reviews
  for delete using (user_id = auth.uid());
create policy "vedara reviews: admin all" on public.reviews
  for all using (public.vedara_is_admin()) with check (public.vedara_is_admin());

-- ============================================================================
-- Grants — anon / authenticated always act through RLS.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant select on
  public.categories, public.products, public.product_images, public.product_variants
  to anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant select, insert, update, delete on
  public.wishlist, public.cart_items, public.reviews, public.profiles
  to authenticated;
grant select, insert on public.orders, public.order_items to authenticated;


-- ##########################################################################
-- ## PART 2 — SEED DATA  (mirrors src/data/products.js)
-- ##########################################################################

-- Categories --------------------------------------------------------------
insert into public.categories (name, slug, description, image_url, sort_order)
values
  ('Floral',   'floral',   'Rose and peony in full bloom.',                 '/images/cat-floral.jpg',   1),
  ('Woody',    'woody',    'Oud and spices, quietly grounding.',            '/images/cat-woody.jpg',    2),
  ('Oriental', 'oriental', 'Amber and warm spices with a lingering trail.', '/images/cat-oriental.jpg', 3),
  ('Fresh',    'fresh',    'Citrus and green leaves, bright and sheer.',    '/images/cat-fresh.jpg',    4)
on conflict (slug) do nothing;

-- Products --------------------------------------------------------------
insert into public.products (
  name, slug, gender, category_id, fragrance_type, family, short_description,
  price, original_price, sizes, stock, sku,
  featured, best_seller, new_arrival, status, rating, review_count,
  top_notes, heart_notes, base_notes, tone
)
select
  v.name, v.slug, v.gender::vedara_gender, c.id, v.fragrance_type, v.family, v.short_description,
  v.price, v.original_price, v.sizes, v.stock, v.sku,
  v.featured, v.best_seller, v.new_arrival, 'active'::vedara_product_status, v.rating, v.review_count,
  v.top_notes, v.heart_notes, v.base_notes, v.tone
from (
  values
    ('Oudh Noir','oudh-noir','Unisex','woody','Eau de Parfum','Oud · Woody','Smoky agarwood wrapped in saffron and warm amber.',6800,null::numeric,array['30ml','50ml','100ml'],40,'VD-OUDH-NOIR',true,true,false,4.8,142,'Saffron, Bergamot','Rose, Oud','Amber, Sandalwood','charcoal'),
    ('Amber Veil','amber-veil','Women','oriental','Eau de Parfum','Amber · Oriental','A soft-focus amber, powdery orris and gentle vanilla.',5900,7200,array['30ml','50ml','100ml'],40,'VD-AMBER-VEIL',true,false,false,4.6,98,'Cardamom, Pink Pepper','Orris, Jasmine','Amber, Vanilla','beige'),
    ('Rose Attar','rose-attar','Women','floral','Parfum','Floral · Attar','Damask rose distilled to its most concentrated form.',7400,null,array['30ml','50ml'],40,'VD-ROSE-ATTAR',true,false,true,4.7,76,'Lychee, Green Leaves','Damask Rose, Peony','Musk, Cedar','ivory'),
    ('Vetiver Smoke','vetiver-smoke','Men','woody','Eau de Parfum','Woody · Smoky','Dry vetiver and guaiac wood over soft leather.',5400,null,array['30ml','50ml','100ml'],40,'VD-VETIVER-SMOKE',true,false,false,4.5,64,'Grapefruit, Nutmeg','Vetiver, Guaiac Wood','Leather, Vanilla','beige'),
    ('Jasmine Hour','jasmine-hour','Women','floral','Eau de Parfum','Floral · White Flowers','Jasmine sambac and tuberose caught at dusk.',5200,null,array['30ml','50ml','100ml'],40,'VD-JASMINE-HOUR',false,false,true,4.4,51,'Neroli, Mandarin','Jasmine Sambac, Tuberose','Sandalwood, Musk','ivory'),
    ('Cardamom Dusk','cardamom-dusk','Unisex','oriental','Eau de Parfum','Spicy · Amber','Green cardamom and incense over resinous benzoin.',5600,null,array['50ml','100ml'],0,'VD-CARDAMOM-DUSK',false,false,false,4.3,37,'Cardamom, Clove','Incense, Rose','Benzoin, Tonka','charcoal'),
    ('Citrus Veil','citrus-veil','Unisex','fresh','Eau de Toilette','Citrus · Green','Sun-warmed bergamot and neroli with a green heart.',4200,null,array['30ml','50ml','100ml'],40,'VD-CITRUS-VEIL',false,false,true,4.2,44,'Bergamot, Lemon Leaf','Neroli, Petitgrain','White Musk, Cedar','ivory'),
    ('Neroli Marine','neroli-marine','Men','fresh','Eau de Toilette','Aromatic · Marine','A cool sea-spray accord lifted by orange blossom.',4600,5400,array['50ml','100ml'],0,'VD-NEROLI-MARINE',false,false,false,4.1,29,'Sea Salt, Mandarin','Orange Blossom, Rosemary','Ambergris, Driftwood','beige'),
    ('Sandal Veil','sandal-veil','Men','woody','Eau de Parfum','Woody · Creamy','Creamy sandalwood softened with milk and tonka.',6200,null,array['30ml','50ml','100ml'],40,'VD-SANDAL-VEIL',false,false,false,4.7,83,'Pink Pepper, Cardamom','Sandalwood, Orris','Tonka, Cashmere Musk','beige'),
    ('White Oud','white-oud','Unisex','floral','Eau de Parfum','Oud · Floral','A luminous oud, brightened with white petals and musk.',7100,null,array['30ml','50ml','100ml'],40,'VD-WHITE-OUD',false,true,false,4.9,121,'Bergamot, Nutmeg','Rose, Magnolia','White Oud, Musk','ivory'),
    ('Saffron Oud','saffron-oud','Men','oriental','Parfum','Leather · Spicy','Saffron-stained leather over a deep amber base.',8200,null,array['30ml','50ml'],40,'VD-SAFFRON-OUD',false,false,false,4.8,67,'Saffron, Black Pepper','Leather, Rose','Oud, Amber','charcoal'),
    ('Tuberose Noir','tuberose-noir','Women','floral','Eau de Parfum','Floral · Narcotic','Opulent tuberose with a smoky, resinous shadow.',6400,7600,array['30ml','50ml','100ml'],40,'VD-TUBEROSE-NOIR',false,true,true,4.5,58,'Green Notes, Bergamot','Tuberose, Ylang-Ylang','Incense, Sandalwood','charcoal')
) as v(name,slug,gender,category_slug,fragrance_type,family,short_description,price,original_price,sizes,stock,sku,featured,best_seller,new_arrival,rating,review_count,top_notes,heart_notes,base_notes,tone)
left join public.categories c on c.slug = v.category_slug
on conflict (slug) do nothing;

-- Product images (primary + one detail shot per product) --------------
insert into public.product_images (product_id, url, alt, sort_order, is_primary)
select p.id, i.url, p.name || case when i.pos = 0 then '' else ' — fragrance note' end, i.pos, i.pos = 0
from (
  values
    ('oudh-noir','/images/product-oudh-noir.jpg',0),      ('oudh-noir','/images/note-oud.jpg',1),
    ('amber-veil','/images/product-amber-veil.jpg',0),    ('amber-veil','/images/note-vanilla.jpg',1),
    ('rose-attar','/images/product-rose-attar.jpg',0),    ('rose-attar','/images/note-rose.jpg',1),
    ('vetiver-smoke','/images/product-vetiver-smoke.jpg',0), ('vetiver-smoke','/images/note-sandalwood.jpg',1),
    ('jasmine-hour','/images/note-jasmine.jpg',0),        ('jasmine-hour','/images/cat-floral.jpg',1),
    ('cardamom-dusk','/images/note-vanilla.jpg',0),       ('cardamom-dusk','/images/note-saffron.jpg',1),
    ('citrus-veil','/images/product1.jpg',0),             ('citrus-veil','/images/cat-fresh.jpg',1),
    ('neroli-marine','/images/product2.jpg',0),           ('neroli-marine','/images/cat-fresh.jpg',1),
    ('sandal-veil','/images/product3.jpg',0),             ('sandal-veil','/images/note-sandalwood.jpg',1),
    ('white-oud','/images/product4.jpg',0),               ('white-oud','/images/note-oud.jpg',1),
    ('saffron-oud','/images/product.jpg',0),              ('saffron-oud','/images/note-saffron.jpg',1),
    ('tuberose-noir','/images/bestseller.jpg',0),         ('tuberose-noir','/images/note-jasmine.jpg',1)
) as i(slug, url, pos)
join public.products p on p.slug = i.slug
where not exists (
  select 1 from public.product_images x where x.product_id = p.id and x.url = i.url
);

-- Variants (one per size) + inventory --------------------------------
insert into public.product_variants (product_id, size, sku)
select p.id, s.size, p.sku || '-' || upper(replace(s.size, 'ml', ''))
from public.products p
cross join lateral unnest(p.sizes) as s(size)
where not exists (
  select 1 from public.product_variants v where v.product_id = p.id and v.size = s.size
);

insert into public.inventory (variant_id, quantity, restock_threshold)
select v.id, case when p.stock > 0 then 15 else 0 end, 5
from public.product_variants v
join public.products p on p.id = v.product_id
where not exists (
  select 1 from public.inventory i where i.variant_id = v.id
);

-- Demo coupon (the code the cart page already accepts) ---------------
insert into public.coupons (code, description, discount_type, discount_value, min_subtotal, active)
values ('VEDARA10', '10% off your order', 'percent', 10, 0, true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Done. Quick check:
--   select count(*) from public.products;          -- 12
--   select slug, stock, status from public.products order by slug;
-- ---------------------------------------------------------------------------
