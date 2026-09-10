/**
 * Signature raw materials for the "Fragrance Notes" section.
 * Descriptive scent copy — not sourcing or product claims.
 * `image` points at a campaign placeholder under public/images/.
 */
export const fragranceNotes = [
  { slug: 'rose', name: 'Rose', note: 'Bright, dewy, endlessly romantic.', image: '/images/note-rose.jpg' },
  { slug: 'saffron', name: 'Saffron', note: 'Leathery warmth with a golden edge.', image: '/images/note-saffron.jpg' },
  { slug: 'oud', name: 'Oud', note: 'Dark agarwood, resinous and deep.', image: '/images/note-oud.jpg' },
  { slug: 'jasmine', name: 'Jasmine', note: 'Heady white petals, green at the edges.', image: '/images/note-jasmine.jpg' },
  { slug: 'vanilla', name: 'Vanilla', note: 'Soft, ambered, quietly sweet.', image: '/images/note-vanilla.jpg' },
  { slug: 'sandalwood', name: 'Sandalwood', note: 'Creamy, meditative, long on skin.', image: '/images/note-sandalwood.jpg' },
];

/**
 * Fragrance families for the "Shop by Fragrance" section.
 * Placeholder counts until a real catalogue exists.
 */
export const fragranceFamilies = [
  {
    slug: 'floral',
    name: 'Floral',
    description: 'Rose and peony in full bloom.',
    count: 9,
    image: '/images/cat-floral.jpg',
    href: '/shop?family=Floral',
  },
  {
    slug: 'woody',
    name: 'Woody',
    description: 'Oud and spices, quietly grounding.',
    count: 7,
    image: '/images/cat-woody.jpg',
    href: '/shop?family=Woody',
  },
  {
    slug: 'oriental',
    name: 'Oriental',
    description: 'Amber and warm spices with a lingering trail.',
    count: 8,
    image: '/images/cat-oriental.jpg',
    href: '/shop?family=Oriental',
  },
  {
    slug: 'fresh',
    name: 'Fresh',
    description: 'Citrus and green leaves, bright and sheer.',
    count: 5,
    image: '/images/cat-fresh.jpg',
    href: '/shop?family=Fresh',
  },
];
