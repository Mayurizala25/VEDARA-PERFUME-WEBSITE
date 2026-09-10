import styles from './Button.module.css';

/**
 * Button — primary interactive control.
 * Renders as <button> by default, or as <a> / any element via `as`.
 *
 * @param {object} props
 * @param {React.ElementType} [props.as='button']
 * @param {'primary'|'secondary'|'ghost'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.fullWidth=false]
 * @param {string} [props.className]
 */
export default function Button({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type,
  children,
  ...rest
}) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const buttonType = Tag === 'button' ? type || 'button' : type;

  return (
    <Tag className={classes} type={buttonType} {...rest}>
      {children}
    </Tag>
  );
}
