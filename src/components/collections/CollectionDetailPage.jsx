import Section from '../layout/Section';
import Container from '../layout/Container';
import SectionHeading from '../common/SectionHeading';
import ProductGrid from '../product/ProductGrid';
import Button from '../ui/Button';
import Reveal from '../ui/Reveal';
import CollectionCard from './CollectionCard';
import { useCollections } from '../../hooks/useCollections';
import { formatPrice } from '../../lib/format';
import styles from './Collections.module.css';

function currentSlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[1] || '').toLowerCase();
}

function DetailHero({ collection }) {
  return (
    <section
      className={styles.detailHero}
      aria-labelledby="collection-heading"
      style={{ '--collection-image': `url(${collection.image})` }}
    >
      <span className={styles.detailHeroImage} aria-hidden="true" />
      <span className={styles.detailHeroScrim} aria-hidden="true" />
      <Container className={styles.detailHeroInner}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <a href="/collections">Collections</a>
          <span aria-hidden="true">/</span>
          <span>{collection.title}</span>
        </nav>
        <p className={styles.eyebrow}>
          {collection.kind === 'audience' ? 'Shop by' : 'Scent family'}
        </p>
        <h1 id="collection-heading">{collection.title}</h1>
        <p className={styles.detailBlurb}>{collection.blurb}</p>
        <div className={styles.detailStats}>
          <span>{collection.count} {collection.count === 1 ? 'fragrance' : 'fragrances'}</span>
          {collection.priceFrom ? <span>From {formatPrice(collection.priceFrom)}</span> : null}
        </div>
        <div className={styles.detailActions}>
          <Button as="a" href={collection.shopHref} variant="primary">
            Shop this collection
          </Button>
          <a href="/collections" className={styles.textLink}>
            <span aria-hidden="true">&larr;</span> All collections
          </a>
        </div>
      </Container>
    </section>
  );
}

/** VEDARA — /collections/:slug. A single collection's live product set. */
export default function CollectionDetailPage() {
  const slug = currentSlug();
  const { all, loading, error } = useCollections();
  const collection = all.find((entry) => entry.slug === slug) || null;
  const notFound = !loading && !error && !collection;

  if (loading) {
    return (
      <main className={styles.detailPage}>
        <div className={styles.stateWrap} aria-busy="true" aria-label="Loading collection">
          <Container>
            <div className={styles.skeletonLines} data-wide>
              <span />
              <span />
            </div>
            <ul className={styles.grid} data-cols="4">
              {Array.from({ length: 8 }, (_, i) => (
                <li key={i}>
                  <div className={styles.skeletonBlock} data-tall />
                </li>
              ))}
            </ul>
          </Container>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.detailPage}>
        <div className={styles.stateWrap}>
          <Container>
            <div className={styles.stateBox}>
              <p className={styles.eyebrow}>VEDARA</p>
              <h2>We couldn’t load this collection.</h2>
              <p>Something interrupted the connection to the catalogue. Please refresh to try again.</p>
              <Button type="button" variant="primary" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </Container>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className={styles.detailPage}>
        <div className={styles.stateWrap}>
          <Container>
            <div className={styles.stateBox}>
              <p className={styles.eyebrow}>Not found</p>
              <h2>That collection doesn’t exist.</h2>
              <p>It may have been renamed. Browse the full set of VEDARA collections instead.</p>
              <Button as="a" href="/collections" variant="primary">
                View all collections
              </Button>
            </div>
          </Container>
        </div>
      </main>
    );
  }

  const others = all.filter((entry) => entry.slug !== slug).slice(0, 4);

  return (
    <main className={styles.detailPage}>
      <DetailHero collection={collection} />

      <Section as="section" tone="default" spacing="sm" aria-labelledby="collection-products-heading">
        <SectionHeading
          id="collection-products-heading"
          eyebrow={collection.tagline || 'The edit'}
          title={`${collection.title} — the full edit`}
          link={{ label: 'Shop with filters', href: collection.shopHref }}
        />
        {collection.products.length ? (
          <ProductGrid products={collection.products} columns={4} priority />
        ) : (
          <div className={styles.stateBox} data-inline>
            <h3>This edit is being composed.</h3>
            <p>No fragrances sit in the {collection.title} collection just yet — explore the full house in the meantime.</p>
            <Button as="a" href="/shop" variant="secondary">Shop all fragrances</Button>
          </div>
        )}
      </Section>

      {others.length ? (
        <Section as="section" tone="beige" spacing="sm" aria-labelledby="other-collections-heading">
          <SectionHeading
            id="other-collections-heading"
            eyebrow="Keep exploring"
            title="Other collections"
          />
          <ul className={styles.grid} data-cols="4">
            {others.map((entry, index) => (
              <li key={entry.slug}>
                <Reveal delay={Math.min(index, 3) * 60}>
                  <CollectionCard collection={entry} />
                </Reveal>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </main>
  );
}
