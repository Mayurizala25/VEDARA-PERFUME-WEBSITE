import Container from './Container';
import styles from './Section.module.css';

/**
 * Section — vertical rhythm + tone wrapper for page sections.
 * Provides consistent top/bottom padding and an optional surface colour,
 * and wraps children in a Container unless `bleed` is set.
 *
 * @param {object} props
 * @param {React.ElementType} [props.as='section']
 * @param {'default'|'beige'|'dark'|'near'} [props.tone='default']
 * @param {boolean} [props.bleed=false]   Skip the inner Container (full-bleed).
 * @param {boolean} [props.wide=false]     Use the wide container max width.
 * @param {'sm'|'md'|'lg'|'none'} [props.spacing='md']
 * @param {string} [props.className]
 * @param {string} [props.containerClassName]
 */
export default function Section({
  as: Tag = 'section',
  tone = 'default',
  bleed = false,
  wide = false,
  spacing = 'md',
  className = '',
  containerClassName = '',
  children,
  ...rest
}) {
  const classes = [
    styles.section,
    styles[`tone-${tone}`],
    styles[`spacing-${spacing}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} {...rest}>
      {bleed ? (
        children
      ) : (
        <Container wide={wide} className={containerClassName}>
          {children}
        </Container>
      )}
    </Tag>
  );
}
