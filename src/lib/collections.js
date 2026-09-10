/**
 * VEDARA — collections data.
 *
 * The Collections page groups the live catalogue two ways:
 *   • by audience     — Men / Women / Unisex           (the products.gender column)
 *   • by scent family — Floral / Woody / Oriental / Fresh (the categories table)
 *
 * Every quantitative field — product count, product list, imagery, price —
 * comes from Supabase via `lib/catalog.js`. Only the short editorial lines are
 * brand copy, consistent with the rest of the storefront's section copy. When
 * Supabase is unconfigured the whole thing resolves from the bundled demo
 * catalogue, exactly like the rest of the app.
 */
import { getCategories, getProducts } from './catalog';

/* Audience groupings — keyed off the real `gender` column on every product. */
const AUDIENCE = [
  {
    slug: 'men',
    title: 'Men',
    kind: 'audience',
    param: 'gender',
    match: 'Men',
    tagline: 'Grounded, warm, quietly assured.',
    blurb:
      'Woods, leather and smoke drawn out slowly — compositions with weight and a long, low trail that settle into the skin rather than announce themselves.',
  },
  {
    slug: 'women',
    title: 'Women',
    kind: 'audience',
    param: 'gender',
    match: 'Women',
    tagline: 'Luminous florals with a lingering warmth.',
    blurb:
      'Rose, jasmine and tuberose composed against amber and musk — full-bloom florals held in balance, radiant up close and soft in their wake.',
  },
  {
    slug: 'unisex',
    title: 'Unisex',
    kind: 'audience',
    param: 'gender',
    match: 'Unisex',
    tagline: 'Shared scent, no fixed address.',
    blurb:
      'Oud, cardamom and citrus built to sit on anyone — the part of the VEDARA wardrobe made to be passed between people, not labelled.',
  },
];

/* Scent families come from the `categories` table; this is only display order. */
const FAMILY_ORDER = ['floral', 'woody', 'oriental', 'fresh'];

const FAMILY_TAGLINE = {
  floral: 'Rose and white flowers in full bloom.',
  woody: 'Oud, vetiver and spice — quietly grounding.',
  oriental: 'Amber and warm spice with a long trail.',
  fresh: 'Citrus and green leaves, bright and sheer.',
};

const FAMILY_BLURB = {
  floral:
    'Damask rose, jasmine sambac and tuberose, distilled and composed with a restrained hand — bright at the top and never cloying.',
  woody:
    'Agarwood, vetiver and sandalwood over soft leather and smoke — the grounding heart of the VEDARA house.',
  oriental:
    'Amber, saffron and warm spice wrapped around resins and vanilla — opulent, slow-burning and unmistakably trailing.',
  fresh:
    'Bergamot, neroli and green leaves lifted by sea air — the lightest register in the collection, sheer but persistent.',
};

const FALLBACK_IMAGE = '/images/story.jpg';

/** Featured / best-seller / best-rated first, so previews lead with the strongest. */
function rankProducts(list) {
  return [...list].sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      Number(b.bestSeller) - Number(a.bestSeller) ||
      (b.rating || 0) - (a.rating || 0) ||
      (b.reviewCount || 0) - (a.reviewCount || 0),
  );
}

function buildCollection(def, members) {
  const products = rankProducts(members);
  const priceFrom = products.reduce(
    (min, p) => (p.price && p.price < min ? p.price : min),
    Infinity,
  );
  return {
    slug: def.slug,
    title: def.title,
    kind: def.kind,
    tagline: def.tagline,
    blurb: def.blurb,
    image: def.image || products.find((p) => p.image)?.image || FALLBACK_IMAGE,
    href: `/collections/${def.slug}`,
    shopHref: `/shop?${def.param}=${def.slug}`,
    count: products.length,
    priceFrom: Number.isFinite(priceFrom) ? priceFrom : null,
    products,
    preview: products.slice(0, 4),
  };
}

let collectionsPromise = null;

/**
 * `{ audience, families, all, featured }` — every collection with its live
 * product set. Resolves once per page load; never rejects (mirrors
 * `lib/catalog.js`). `featured` is the richest collection (most products,
 * then most featured products) — surfaced as the page's hero collection.
 */
export function getCollections() {
  if (!collectionsPromise) {
    collectionsPromise = (async () => {
      const [products, categories] = await Promise.all([getProducts(), getCategories()]);
      const catalogue = Array.isArray(products) ? products : [];

      const audience = AUDIENCE.map((def) =>
        buildCollection(def, catalogue.filter((p) => p.gender === def.match)),
      );

      const families = [...(categories || [])]
        .filter((cat) => FAMILY_ORDER.includes((cat.name || '').toLowerCase()))
        .sort(
          (a, b) =>
            FAMILY_ORDER.indexOf(a.name.toLowerCase()) -
            FAMILY_ORDER.indexOf(b.name.toLowerCase()),
        )
        .map((cat) => {
          const key = cat.name.toLowerCase();
          return buildCollection(
            {
              slug: key,
              title: cat.name,
              kind: 'family',
              param: 'family',
              tagline: cat.description || FAMILY_TAGLINE[key] || '',
              blurb: FAMILY_BLURB[key] || cat.description || FAMILY_TAGLINE[key] || '',
              image: cat.image,
            },
            catalogue.filter((p) => p.category === cat.name),
          );
        });

      const all = [...audience, ...families];
      const featured = [...all]
        .filter((c) => c.count > 0)
        .sort(
          (a, b) =>
            b.count - a.count ||
            b.preview.filter((p) => p.featured).length -
              a.preview.filter((p) => p.featured).length,
        )[0] || all[0] || null;

      return { audience, families, all, featured };
    })();
  }
  return collectionsPromise;
}
