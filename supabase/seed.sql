-- ============================================================================
-- VEDARA — seed data
-- ----------------------------------------------------------------------------
-- Mirrors the bundled demo catalogue (src/data/products.js) so the storefront
-- shows real Supabase data straight after connecting.
--
-- Run AFTER 0001_initial_schema.sql, in the Supabase SQL Editor.
-- Idempotent: re-running does not create duplicates.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Categories (fragrance families)
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, description, image_url, sort_order)
values
  ('Floral',   'floral',   'Rose and peony in full bloom.',                    '/images/cat-floral.jpg',   1),
  ('Woody',    'woody',    'Oud and spices, quietly grounding.',               '/images/cat-woody.jpg',    2),
  ('Oriental', 'oriental', 'Amber and warm spices with a lingering trail.',    '/images/cat-oriental.jpg', 3),
  ('Fresh',    'fresh',    'Citrus and green leaves, bright and sheer.',       '/images/cat-fresh.jpg',    4)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Product images (primary + one detail shot per product)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Variants (one per size) + inventory
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Demo coupon (matches the code the cart page already accepts)
-- ---------------------------------------------------------------------------
insert into public.coupons (code, description, discount_type, discount_value, min_subtotal, active)
values ('VEDARA10', '10% off your order', 'percent', 10, 0, true)
on conflict (code) do nothing;
