import Section from '../layout/Section';
import Reveal from '../ui/Reveal';
import Icon from '../ui/Icon';
import { benefits } from '../../data/benefits';
import styles from './WhyVedara.module.css';

/** Why Choose VEDARA — house principles in an asymmetric editorial grid. */
export default function WhyVedara() {
  return (
    <Section as="section" tone="default" spacing="sm" aria-labelledby="why-heading" containerClassName={styles.container}>
      <div className={styles.layout}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>The VEDARA Difference</p>
          <h2 id="why-heading" className={styles.title}>
            Why Choose VEDARA
          </h2>
          <p className={styles.lede}>
            Four principles behind every bottle — concentration, sourcing,
            batch size and packaging, held to the same standard.
          </p>
        </div>

        <ul className={styles.grid}>
          {benefits.map((benefit, i) => (
            <li key={benefit.title} className={styles.item}>
              <Reveal delay={Math.min(i, 3) * 60}>
                <span className={styles.idx} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Icon name={benefit.icon} size={24} className={styles.icon} />
                <h3 className={styles.itemTitle}>{benefit.title}</h3>
                <p className={styles.text}>{benefit.text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
