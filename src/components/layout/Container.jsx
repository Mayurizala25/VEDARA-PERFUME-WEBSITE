import styles from './Container.module.css';

/**
 * Container — horizontal layout wrapper.
 * Centres content, applies responsive gutters and a max width.
 *
 * @param {object}  props
 * @param {React.ElementType} [props.as='div']  Element/component to render as.
 * @param {boolean} [props.wide=false]          Use the wider max width.
 * @param {string}  [props.className]
 */
export default function Container({
  as: Tag = 'div',
  wide = false,
  className = '',
  children,
  ...rest
}) {
  const classes = [styles.container, wide && styles.wide, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
