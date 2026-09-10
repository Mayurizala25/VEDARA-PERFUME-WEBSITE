import styles from './SectionHeading.module.css';

/**
 * SectionHeading — consistent eyebrow + title (+ optional intro / trailing link)
 * used at the top of homepage sections.
 *
 * @param {string}  props.eyebrow
 * @param {string}  props.title
 * @param {2|3}     [props.level=2]      Heading element level.
 * @param {string}  [props.intro]
 * @param {{label:string, href:string}} [props.link]
 * @param {'left'|'center'} [props.align='left']
 * @param {boolean} [props.onDark=false]
 */
export default function SectionHeading({
  eyebrow,
  title,
  level = 2,
  intro,
  link,
  align = 'left',
  onDark = false,
  flush = false,
  id,
}) {
  const Tag = `h${level}`;
  return (
    <div
      className={[
        styles.wrap,
        styles[align],
        onDark && styles.onDark,
        flush && styles.flush,
        link && styles.hasLink,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.text}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <Tag className={styles.title} id={id}>
          {title}
        </Tag>
        {intro ? <p className={styles.intro}>{intro}</p> : null}
      </div>
      {link ? (
        <a href={link.href} className={styles.link}>
          {link.label}
          <span aria-hidden="true">&nbsp;&rarr;</span>
        </a>
      ) : null}
    </div>
  );
}
