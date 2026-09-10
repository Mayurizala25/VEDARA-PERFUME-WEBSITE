import Section from '../layout/Section';
import Button from '../ui/Button';
import Reveal from '../ui/Reveal';
import Figure from '../ui/Figure';
import styles from './BrandStory.module.css';

/** VEDARA Brand Story — asymmetric editorial: large image + measured copy. */
export default function BrandStory() {
  return (
    <Section as="section" tone="default" spacing="sm" aria-labelledby="story-heading" containerClassName={styles.container}>
      <div className={styles.layout}>
        <Reveal className={styles.mediaCol}>
          <Figure
            src="/images/story.jpg"
            alt="VEDARA — modern Indian perfumery"
            ratio="4 / 5"
            tone="beige"
            className={styles.media}
            sizes="(min-width: 860px) 46vw, 90vw"
          />
          <p className={styles.caption}>
            <span aria-hidden="true">—</span> Blended and rested in small batches
          </p>
        </Reveal>

        <div className={styles.text}>
          <p className={styles.eyebrow}>Our Story</p>
          <h2 id="story-heading" className={styles.title}>
            A modern house, rooted in Indian perfumery
          </h2>
          <p>
            VEDARA began with a simple idea: the attar tradition of India —
            rose, jasmine, oud, sandalwood — deserves a contemporary voice.
            We work with named growers and distillers, then compose with
            restraint, letting a few materials speak clearly.
          </p>
          <p>
            Every fragrance is blended in small batches and rested before
            bottling. The flacon is refillable; the packaging is deliberately
            plain. What matters is what you wear.
          </p>
          <span className={styles.divider} aria-hidden="true" />
          <p className={styles.signature}>Wear Your Essence.</p>
          <Button as="a" href="/about" variant="secondary" className={styles.cta}>
            Read the full story
          </Button>
        </div>
      </div>
    </Section>
  );
}
