/**
 * Icon — thin line glyphs on a 24×24 grid, stroked with currentColor.
 * Decorative by default (aria-hidden); pass a `title` to make it labelled.
 */
const PATHS = {
  drop: <path d="M12 3.5c3.5 4 5.5 6.7 5.5 9.5a5.5 5.5 0 0 1-11 0c0-2.8 2-5.5 5.5-9.5Z" />,
  leaf: (
    <>
      <path d="M20 4C10 4 5 9 5 17c8 0 15-4 15-13Z" />
      <path d="M5 19c3-6 7-9 12-11" />
    </>
  ),
  flask: (
    <>
      <path d="M10 3h4M10 3v6l-4.5 8A2 2 0 0 0 7.3 20h9.4a2 2 0 0 0 1.8-3L14 9V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  ribbon: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M9 13.5 7 21l5-2.5L17 21l-2-7.5" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  search: <><circle cx="10.8" cy="10.8" r="5.8" /><path d="m15.2 15.2 4.3 4.3" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  close: <><path d="M5 5l14 14" /><path d="M19 5 5 19" /></>,
  heart: <path d="M12 20.5C6.5 16.9 4 13.6 4 10.2A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 8 2.2c0 3.4-2.5 6.7-8 10.3Z" />,
  whatsapp: (
    <>
      <path d="M5.5 18.5 4 20l1.6-.5A8 8 0 1 0 4 12a7.9 7.9 0 0 0 1.5 4.6Z" />
      <path d="M9.2 8.6c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.2-.2.3 0 .6a6 6 0 0 0 2.7 2.4c.3.1.4.1.6-.1l.6-.7c.2-.2.3-.2.6-.1l1.6.8c.3.1.4.2.4.4s0 .9-.4 1.4c-.4.5-1.3.9-1.9.9a7.3 7.3 0 0 1-6.9-6.4c0-1 .3-1.9.6-2.4Z" fill="currentColor" stroke="none" />
    </>
  ),
  star: <path d="M12 4l2.35 4.76 5.25.76-3.8 3.7.9 5.24L12 16.9l-4.7 2.47.9-5.24-3.8-3.7 5.25-.76L12 4Z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M5 20c1.3-3.8 4-5.6 7-5.6s5.7 1.8 7 5.6" />
    </>
  ),
};

export default function Icon({ name, size = 24, strokeWidth = 1.4, title, className = '' }) {
  const glyph = PATHS[name];
  if (!glyph) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {glyph}
    </svg>
  );
}
