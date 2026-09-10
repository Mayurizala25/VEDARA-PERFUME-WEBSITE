import { useEffect, useMemo, useState } from 'react';
import Container from '../layout/Container';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Reveal from '../ui/Reveal';
import ShopProductCard from './ShopProductCard';
import ShopFilters from './ShopFilters';
import ShopQuickView from './ShopQuickView';
import { products as demoProducts, shopGenders, fragranceFamilyOptions } from '../../data/products';
import { useProducts } from '../../hooks/useCatalog';
import styles from './ShopPage.module.css';

const PAGE_SIZE = 8;
const SIZE_OPTIONS = ['30ml', '50ml', '100ml'];
const RATING_VALUES = [0, 3.5, 4, 4.5];

// Filter bounds / options for URL parsing and the filter panel. Derived from
// the bundled catalogue so they are stable for shareable URLs; the displayed
// product list itself comes from Supabase (via useProducts) when configured.
const PRICE_BOUNDS = [
  Math.floor(Math.min(...demoProducts.map((p) => p.price)) / 100) * 100,
  Math.ceil(Math.max(...demoProducts.map((p) => p.price)) / 100) * 100,
];

const TYPE_OPTIONS = [...new Set(demoProducts.map((p) => p.fragranceType))].sort();

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'best-selling', label: 'Best selling' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
  { value: 'rating', label: 'Rating' },
];
const SORT_VALUES = SORT_OPTIONS.map((option) => option.value);

const DEFAULT_FILTERS = {
  gender: 'All',
  families: [],
  types: [],
  price: PRICE_BOUNDS,
  sizes: [],
  inStockOnly: false,
  minRating: 0,
  bestSellerOnly: false,
  newArrivalOnly: false,
};

/* ---- Shareable URL state ------------------------------------------------ */

function readListParam(params, key) {
  const raw = params.get(key);
  return raw ? raw.split(',').map((value) => value.trim()).filter(Boolean) : [];
}

// Match a URL value against a canonical option list, case-insensitively, so
// deep links like `/shop?gender=men` or `?family=floral` (from the Collections
// page) resolve to the exact filter value the UI uses.
function canonical(value, options) {
  if (!value) return null;
  return options.find((option) => option.toLowerCase() === String(value).toLowerCase()) || null;
}

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const gender = canonical(params.get('gender'), shopGenders) || 'All';
  const families = readListParam(params, 'family')
    .map((f) => canonical(f, fragranceFamilyOptions))
    .filter(Boolean);
  const types = readListParam(params, 'type').filter((t) => TYPE_OPTIONS.includes(t));
  const sizes = readListParam(params, 'size').filter((s) => SIZE_OPTIONS.includes(s));

  const min = Number(params.get('min'));
  const max = Number(params.get('max'));
  const lo = Number.isFinite(min) && min >= PRICE_BOUNDS[0] && min < PRICE_BOUNDS[1] ? min : PRICE_BOUNDS[0];
  const hi = Number.isFinite(max) && max > PRICE_BOUNDS[0] && max <= PRICE_BOUNDS[1] ? max : PRICE_BOUNDS[1];
  const price = lo < hi ? [lo, hi] : [...PRICE_BOUNDS];

  const ratingParam = Number(params.get('rating'));
  const minRating = RATING_VALUES.includes(ratingParam) ? ratingParam : 0;

  const sort = SORT_VALUES.includes(params.get('sort')) ? params.get('sort') : 'featured';
  const query = params.get('q') || '';

  return {
    filters: {
      gender,
      families,
      types,
      price,
      sizes,
      inStockOnly: params.get('instock') === '1',
      minRating,
      bestSellerOnly: params.get('best') === '1',
      newArrivalOnly: params.get('new') === '1',
    },
    sort,
    query,
  };
}

function writeStateToUrl(filters, sort, query) {
  const params = new URLSearchParams();
  if (filters.gender !== 'All') params.set('gender', filters.gender);
  if (filters.families.length) params.set('family', filters.families.join(','));
  if (filters.types.length) params.set('type', filters.types.join(','));
  if (filters.price[0] !== PRICE_BOUNDS[0]) params.set('min', String(filters.price[0]));
  if (filters.price[1] !== PRICE_BOUNDS[1]) params.set('max', String(filters.price[1]));
  if (filters.sizes.length) params.set('size', filters.sizes.join(','));
  if (filters.minRating) params.set('rating', String(filters.minRating));
  if (filters.inStockOnly) params.set('instock', '1');
  if (filters.bestSellerOnly) params.set('best', '1');
  if (filters.newArrivalOnly) params.set('new', '1');
  if (sort !== 'featured') params.set('sort', sort);
  if (query.trim()) params.set('q', query.trim());

  const qs = params.toString();
  window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
}

function countActive(filters, query) {
  return (
    (filters.gender !== 'All' ? 1 : 0) +
    filters.families.length +
    filters.types.length +
    (filters.price[0] !== PRICE_BOUNDS[0] || filters.price[1] !== PRICE_BOUNDS[1] ? 1 : 0) +
    filters.sizes.length +
    (filters.inStockOnly ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.bestSellerOnly ? 1 : 0) +
    (filters.newArrivalOnly ? 1 : 0) +
    (query.trim() ? 1 : 0)
  );
}

export default function ShopPage() {
  const initial = useMemo(readStateFromUrl, []);
  const { products, loading: catalogLoading } = useProducts();
  const [filters, setFilters] = useState(initial.filters);
  const [query, setQuery] = useState(initial.query);
  const [sort, setSort] = useState(initial.sort);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [settling, setSettling] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickView, setQuickView] = useState(null);
  const loading = settling || catalogLoading;

  const patchFilters = (patch) => setFilters((current) => ({ ...current, ...patch }));
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setQuery('');
    setSort('featured');
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setSettling(false), 320);
    return () => window.clearTimeout(timer);
  }, []);

  // Keep the URL in sync so any filter combination is shareable / bookmarkable.
  useEffect(() => {
    writeStateToUrl(filters, sort, query);
  }, [filters, sort, query]);

  // Respond to browser back / forward.
  useEffect(() => {
    const onPopState = () => {
      const next = readStateFromUrl();
      setFilters(next.filters);
      setSort(next.sort);
      setQuery(next.query);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Body scroll lock while the mobile filter drawer is open.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => event.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = products.filter((product) => {
      const notes = product.notes || {};
      const haystack = `${product.name} ${product.gender} ${product.category} ${product.family} ${product.fragranceType} ${product.shortDescription} ${Object.values(notes).join(' ')}`.toLowerCase();
      return (
        (filters.gender === 'All' || product.gender === filters.gender) &&
        (!filters.families.length || filters.families.includes(product.category)) &&
        (!filters.types.length || filters.types.includes(product.fragranceType)) &&
        product.price >= filters.price[0] &&
        product.price <= filters.price[1] &&
        (!filters.sizes.length || filters.sizes.some((size) => product.sizes.includes(size))) &&
        (!filters.inStockOnly || product.inStock) &&
        product.rating >= filters.minRating &&
        (!filters.bestSellerOnly || product.badges.includes('bestseller')) &&
        (!filters.newArrivalOnly || product.badges.includes('new')) &&
        (!q || haystack.includes(q))
      );
    });

    const byNew = (a, b) => Number(b.badges.includes('new')) - Number(a.badges.includes('new'));
    const byBest = (a, b) => Number(b.badges.includes('bestseller')) - Number(a.badges.includes('bestseller'));

    return [...result].sort((a, b) => {
      if (sort === 'price-low') return a.price - b.price;
      if (sort === 'price-high') return b.price - a.price;
      if (sort === 'rating') return b.rating - a.rating || b.reviewCount - a.reviewCount;
      if (sort === 'newest') return byNew(a, b) || b.reviewCount - a.reviewCount;
      if (sort === 'best-selling') return byBest(a, b) || b.reviewCount - a.reviewCount;
      return Number(b.featured) - Number(a.featured) || b.rating - a.rating;
    });
  }, [products, filters, query, sort]);

  // Reset pagination whenever the result set changes.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [filters, query, sort]);

  const shown = filtered.slice(0, visible);
  const activeCount = countActive(filters, query);
  const outOfStockCount = filtered.filter((p) => !p.inStock).length;

  const filterPanel = (
    <ShopFilters
      value={filters}
      onChange={patchFilters}
      genders={shopGenders}
      familyOptions={fragranceFamilyOptions}
      typeOptions={TYPE_OPTIONS}
      priceBounds={PRICE_BOUNDS}
      resultCount={filtered.length}
      onReset={resetFilters}
    />
  );

  return (
    <>
      <section className={styles.hero} aria-labelledby="shop-heading">
        <div className={styles.heroImage} aria-hidden="true" />
        <Container className={styles.heroInner}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <a href="/">Home</a><span aria-hidden="true">/</span><span>Shop</span>
          </nav>
          <p className={styles.eyebrow}>The VEDARA Collection</p>
          <h1 id="shop-heading">Shop VEDARA</h1>
          <p className={styles.heroCopy}>
            Every VEDARA fragrance is composed to become part of your signature — warm, deliberate
            and quietly Indian in spirit. Explore the full house below.
          </p>
        </Container>
      </section>

      <nav className={styles.categoryNav} aria-label="Shop by category">
        <Container className={styles.categoryNavInner}>
          {shopGenders.map((gender) => (
            <button
              type="button"
              key={gender}
              className={styles.categoryTab}
              data-active={filters.gender === gender || undefined}
              aria-pressed={filters.gender === gender}
              onClick={() => patchFilters({ gender })}
            >
              {gender === 'All' ? 'All fragrances' : gender}
            </button>
          ))}
        </Container>
      </nav>

      <section className={styles.catalogue} aria-labelledby="catalogue-heading">
        <Container>
          <h2 id="catalogue-heading" className="visually-hidden">Fragrance catalogue</h2>

          <div className={styles.toolbar}>
            <p className={styles.resultCount}>
              {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'fragrance' : 'fragrances'}`}
              {filters.gender !== 'All' ? <span> · {filters.gender}</span> : null}
            </p>

            <div className={styles.toolbarControls}>
              <label className={styles.search}>
                <Icon name="search" size={18} />
                <span className="visually-hidden">Search fragrances by name, category or notes</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, notes, category"
                />
              </label>

              <label className={styles.sort}>
                <span>Sort</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <button type="button" className={styles.filterTrigger} onClick={() => setDrawerOpen(true)}>
                <Icon name="filter" size={18} /> Filters
                {activeCount ? <span className={styles.filterBadge}>{activeCount}</span> : null}
              </button>
            </div>
          </div>

          <div className={styles.layout}>
            <aside className={styles.sidebar} aria-label="Product filters">
              <div className={styles.sidebarSticky}>
                <div className={styles.sidebarHead}>
                  <h3>Filters</h3>
                  {activeCount ? (
                    <button type="button" className={styles.clearLink} onClick={resetFilters}>Clear ({activeCount})</button>
                  ) : null}
                </div>
                {filterPanel}
              </div>
            </aside>

            <div className={styles.results}>
              {loading ? (
                <ul className={styles.grid} aria-label="Loading fragrances" aria-busy="true">
                  {Array.from({ length: 8 }, (_, index) => (
                    <li key={index}><div className={styles.skeleton} /></li>
                  ))}
                </ul>
              ) : shown.length ? (
                <>
                  {outOfStockCount > 0 ? (
                    <p className={styles.notice}>
                      {outOfStockCount} of these {outOfStockCount === 1 ? 'fragrance is' : 'fragrances are'} currently out of stock.
                    </p>
                  ) : null}

                  <ul className={styles.grid}>
                    {shown.map((product, index) => (
                      <li key={product.slug}>
                        <Reveal delay={Math.min(index, 3) * 60}>
                          <ShopProductCard
                            product={product}
                            onQuickView={setQuickView}
                            priority={index < 4}
                          />
                        </Reveal>
                      </li>
                    ))}
                  </ul>

                  {visible < filtered.length ? (
                    <div className={styles.loadMore}>
                      <p>Showing {shown.length} of {filtered.length}</p>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setVisible((value) => value + PAGE_SIZE)}
                      >
                        Load more
                      </Button>
                    </div>
                  ) : (
                    <p className={styles.endNote}>You’ve reached the end of the collection.</p>
                  )}
                </>
              ) : (
                <div className={styles.empty}>
                  <p className={styles.eyebrow}>Nothing found</p>
                  <h3>No fragrances match these filters.</h3>
                  <p>Try widening your price range, clearing a filter, or searching a different note.</p>
                  <Button type="button" variant="secondary" onClick={resetFilters}>Clear all filters</Button>
                </div>
              )}
            </div>
          </div>
        </Container>
      </section>

      <div
        className={styles.drawerOverlay}
        data-open={drawerOpen || undefined}
        onClick={() => setDrawerOpen(false)}
        role="presentation"
      >
        <aside
          className={styles.drawer}
          aria-label="Product filters"
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.drawerHead}>
            <h3>Filters &amp; sort</h3>
            <button type="button" aria-label="Close filters" onClick={() => setDrawerOpen(false)}>
              <Icon name="close" size={22} />
            </button>
          </div>

          <div className={styles.drawerBody}>
            <label className={styles.drawerSort}>
              <span>Sort by</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            {filterPanel}
          </div>

          <div className={styles.drawerFoot}>
            <Button type="button" variant="secondary" size="sm" onClick={resetFilters}>Clear all</Button>
            <Button type="button" variant="primary" fullWidth onClick={() => setDrawerOpen(false)}>
              View {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            </Button>
          </div>
        </aside>
      </div>

      {quickView ? <ShopQuickView product={quickView} onClose={() => setQuickView(null)} /> : null}
    </>
  );
}
