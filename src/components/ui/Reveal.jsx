import { useReveal } from '../../hooks/useReveal';
import styles from './Reveal.module.css';

/**
 * Reveal — wraps children in a subtle fade/rise that triggers on scroll.
 * `delay` (ms) staggers siblings. Collapses to a no-op under reduced motion.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const [ref, shown] = useReveal();
  return (
    <Tag
      ref={ref}
      className={[styles.reveal, shown && styles.shown, className].filter(Boolean).join(' ')}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
