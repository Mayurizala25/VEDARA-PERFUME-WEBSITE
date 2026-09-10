import Section from '../layout/Section';
import Container from '../layout/Container';
import SectionHeading from '../common/SectionHeading';
import ProductGrid from '../product/ProductGrid';
import Button from '../ui/Button';
import Reveal from '../ui/Reveal';
import Figure from '../ui/Figure';
import CollectionCard from './CollectionCard';
import { useCollections } from '../../hooks/useCollections';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatPrice } from '../../lib/format';
import styles from './Collections.module.css';

function CollectionsHero() {
  return (
    <section className={styles.hero} aria-labelledby="collections-heading">
      <div className={styles.heroImage} aria-hidden="true" />
      <span className={styles.heroScrim} aria-hidden="true" />
      <Container className={styles.heroInner}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span>Collections</span>
        </nav>
        <p className={styles.eyebrow}>The VEDARA Edit</p>
        <h1 id="collections-heading">Collections</h1>
        <p className={styles.heroCopy}>
          A considered wardrobe of scent — arranged by who it is for and by the
          materials at its heart. Every edit below is drawn live from the VEDARA
          catalogue.
        </p>
      </Container>
    </section>
  );
}

function FeaturedCollection({ collection }) {
  return (
    <Section
      as="section"
      tone="default"
      spacing="sm"
      aria-labelledby="featured-collection-heading"
      containerClassName={styles.featured}
    >
      <Reveal className={styles.featuredMedia}>
        <Figure
          src={collection.image}
          alt={`${collection.title} collection`}
          ratio="4 / 5"
          tone="cherry"
          priority
          className={styles.featuredFigure}
          sizes="(min-width: 900px) 46vw, 92vw"
        />
        <span className={styles.featuredTag}>Featured collection</span>
      </Reveal>

      <div className={styles.featuredBody}>
        <p className={styles.eyebrow}>
          {collection.kind === 'audience' ? 'Shop by' : 'Scent family'}
        </p>
        <h2 id="featured-collection-heading">{collection.title}</h2>
        <p className={styles.featuredBlurb}>{collection.blurb}</p>

        <dl className={styles.featuredStats}>
          <div>
            <dt>Fragrances</dt>
            <dd>{collection.count}</dd>
          </div>
          {collection.priceFrom ? (
            <div>
              <dt>From</dt>
              <dd>{formatPrice(collection.priceFrom)}</dd>
            </div>
          ) : null}
        </dl>

        {collection.preview.length ? (
          <ul className={styles.featuredThumbs} aria-label={`${collection.title} highlights`}>
            {collection.preview.map((product) => (
              <li key={product.slug}>
                <a href={`/product/${product.slug}`} aria-label={product.name}>
                  <Figure
                    src={product.image}
                    alt={product.name}
                    ratio="1 / 1"
                    tone="beige"
                    zoom={false}
                    sizes="(min-width: 900px) 120px, 22vw"
                  />
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <div className={styles.featuredActions}>
          <Button as="a" href={collection.href} variant="primary">
            Explore {collection.title}
          </Button>
          <a href={collection.shopHref} className={styles.textLink}>
            Shop the collection <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
    </Section>
  );
}

function CollectionRail({ collection }) {
  if (!collection.products.length) return null;
  return (
    <div className={styles.rail}>
      <div className={styles.railHead}>
        <div>
          <p className={styles.eyebrow}>
            {collection.count} {collection.count === 1 ? 'fragrance' : 'fragrances'}
          </p>
          <h3>{collection.title}</h3>
        </div>
        <a href={collection.href} className={styles.textLink}>
          View collection <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
      <ProductGrid products={collection.products.slice(0, 8)} columns={4} carousel />
    </div>
  );
}

function CollectionsSkeleton() {
  return (
    <div className={styles.stateWrap} aria-busy="true" aria-label="Loading collections">
      <Container>
        <div className={styles.skeletonFeatured}>
          <div className={styles.skeletonBlock} data-tall />
          <div className={styles.skeletonLines}>
            <span />
            <span />
            <span />
          </div>
        </div>
        <ul className={styles.grid} data-cols="3">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <div className={styles.skeletonBlock} data-tall />
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}

function CollectionsMessage({ title, text, action }) {
  return (
    <div className={styles.stateWrap}>
      <Container>
        <div className={styles.stateBox}>
          <p className={styles.eyebrow}>VEDARA</p>
          <h2>{title}</h2>
          <p>{text}</p>
          {action}
        </div>
      </Container>
    </div>
  );
}

/** VEDARA — /collections. Editorial index of every collection, on live data. */
export default function CollectionsPage() {
  const { audience, families, all, featured, loading, error } = useCollections();
  // Phones get a leaner page: the audience cards already lead into every
  // collection, so the per-collection product rails are desktop/tablet only.
  const isPhone = useMediaQuery('(max-width: 47.99em)');

  if (loading) {
    return (
      <>
        <CollectionsHero />
        <CollectionsSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <>
        <CollectionsHero />
        <CollectionsMessage
          title="We couldn’t load the collections."
          text="Something interrupted the connection to the catalogue. Please refresh to try again."
          action={
            <Button type="button" variant="primary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
        />
      </>
    );
  }

  if (!all.length) {
    return (
      <>
        <CollectionsHero />
        <CollectionsMessage
          title="No collections yet."
          text="The VEDARA catalogue is being prepared. In the meantime, browse the full house."
          action={<Button as="a" href="/shop" variant="primary">Shop all fragrances</Button>}
        />
      </>
    );
  }

  const rails = isPhone ? [] : audience.filter((collection) => collection.count > 0);

  return (
    <>
      <CollectionsHero />

      {featured ? <FeaturedCollection collection={featured} /> : null}

      <Section as="section" tone="default" spacing="sm" aria-labelledby="audience-heading">
        <SectionHeading
          id="audience-heading"
          eyebrow="Shop by"
          title="Find your edit"
          intro="Three ways into the house — grounded, luminous or shared between people."
        />
        <ul className={styles.grid} data-cols="3">
          {audience.map((collection, index) => (
            <li key={collection.slug}>
              <Reveal delay={Math.min(index, 3) * 60}>
                <CollectionCard collection={collection} size="lg" priority={index === 0} />
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      <Section as="section" tone="beige" spacing="sm" aria-labelledby="families-heading">
        <SectionHeading
          id="families-heading"
          eyebrow="By scent family"
          title="Begin with a material"
          intro="The notes and moods that draw you in — from full-bloom florals to deep, resinous woods."
        />
        <ul className={styles.grid} data-cols="4">
          {families.map((collection, index) => (
            <li key={collection.slug}>
              <Reveal delay={Math.min(index, 3) * 60}>
                <CollectionCard collection={collection} />
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      {rails.length ? (
        <Section as="section" tone="default" spacing="sm" aria-labelledby="closer-heading">
          <SectionHeading
            id="closer-heading"
            eyebrow="A closer look"
            title="Inside each edit"
            intro="A preview of what each audience collection holds right now."
          />
          <div className={styles.rails}>
            {rails.map((collection) => (
              <CollectionRail key={collection.slug} collection={collection} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section as="section" tone="dark" spacing="sm" containerClassName={styles.cta}>
        <p className={styles.eyebrow}>Not sure where to start?</p>
        <h2>See the full house.</h2>
        <Button as="a" href="/shop" variant="light">
          Shop all fragrances
        </Button>
      </Section>
    </>
  );
}
