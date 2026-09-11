/**
 * VEDARA admin — shared UI primitives. Kept in one file on purpose: they are
 * tiny and always used together.
 */
import { useEffect, useRef, useState } from 'react';
import s from '../admin.module.css';

export { s as styles };

/* ---- Icons (thin line, 20px grid) --------------------------------- */
const P = {
  dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  box: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
  tag: 'M20.6 13.4 12 22l-9-9V4h9zM7.5 7.5h.01',
  cart: 'M6 6h15l-1.5 9h-12zM6 6 5 3H2M9 20h.01M18 20h.01',
  users: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87',
  layers: 'm12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5',
  star: 'M12 4l2.35 4.76 5.25.76-3.8 3.7.9 5.24L12 16.9l-4.7 2.47.9-5.24-3.8-3.7 5.25-.76z',
  ticket: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.5 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.18 14a2 2 0 0 1 0-4 1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 3.18 2 2 0 0 1 14 3a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.82 10 2 2 0 0 1 21 14a1.65 1.65 0 0 0-1.6 1z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  menu: 'M3 6h18M3 12h18M3 18h18',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M20 6 9 17l-5-5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M9.9 4.24A9.1 9.1 0 0 1 12 4c6 0 10 7 10 7a17 17 0 0 1-2.16 3M6.6 6.6A17 17 0 0 0 2 11s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6M3 3l18 18',
  external: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  printer: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
  upload: 'M12 15V3M7 8l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',  chart: 'M3 3h7v7H3zM14 3h7v4h-7zM3 14h7v7H3zM14 10h7v11h-7z',
  sheet: 'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16',
};

export function Icon({ name, size = 18 }) {
  const d = P[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* ---- Buttons ---------------------------------------------------- */
export function Button({ variant = 'ghost', size, icon, iconRight, children, className = '', ...rest }) {
  const cls = [s.btn, s[`btn${variant[0].toUpperCase()}${variant.slice(1)}`], size === 'sm' && s.btnSm, className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 14 : 16} /> : null}
    </button>
  );
}

/* ---- States --------------------------------------------------- */
export function Spinner({ label }) {
  return <div className={s.center}><span className={s.spinner} />{label ? <span>{label}</span> : null}</div>;
}
export function ErrorState({ error, onRetry }) {
  return (
    <div className={s.center}>
      <p className={s.errorBox}>{error?.message || 'Something went wrong loading this page.'}</p>
      {onRetry ? <Button variant="ghost" onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}
export function EmptyState({ title = 'Nothing here yet', text, action }) {
  return <div className={s.empty}><h3>{title}</h3>{text ? <p>{text}</p> : null}{action ? <div style={{ marginTop: '1rem' }}>{action}</div> : null}</div>;
}

/* ---- Page header --------------------------------------------- */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className={s.pageHead}>
      <div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
      {children ? <div className={s.pageActions}>{children}</div> : null}
    </div>
  );
}

/* ---- Form field ------------------------------------------- */
export function Field({ label, hint, error, children }) {
  return (
    <div className={s.field}>
      {label ? <span className={s.fieldLabel}>{label}</span> : null}
      {children}
      {hint && !error ? <span className={s.fieldHint}>{hint}</span> : null}
      {error ? <span className={s.fieldError}>{error}</span> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className={s.toggle}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={s.toggleTrack} data-on={checked || undefined}><span className={s.toggleKnob} /></span>
      {label ? <span>{label}</span> : null}
    </label>
  );
}

/* ---- Search input ---------------------------------------- */
export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className={`${s.search} ${s.grow}`}>
      <Icon name="search" size={15} />
      <input className={s.input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ---- Status badge --------------------------------------- */
const TONES = {
  active: 'green', delivered: 'green', approved: 'green', paid: 'green', resolved: 'green',
  pending: 'amber', processing: 'blue', confirmed: 'blue', shipped: 'blue', new: 'amber', contacted: 'blue',
  draft: 'grey', archived: 'grey', inactive: 'grey', hidden: 'grey', suspended: 'grey', read: 'grey', replied: 'blue',
  cancelled: 'red', refunded: 'red', 'out of stock': 'red', 'low stock': 'amber', 'in stock': 'green',
};
export function Badge({ children, tone }) {
  const t = tone || TONES[String(children).toLowerCase()] || 'grey';
  return <span className={s.badge} data-tone={t}>{children}</span>;
}

/* ---- Money -------------------------------------------- */
export function Money({ value }) {
  const n = Number(value) || 0;
  return <>₹{n.toLocaleString('en-IN')}</>;
}

/* ---- Confirm dialog --------------------------------- */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel, busy }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className={s.overlay} role="presentation" onClick={onCancel}>
      <div className={s.dialog} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {message ? <p>{message}</p> : null}
        <div className={s.dialogActions}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---- Modal shell ---------------------------------- */
export function Modal({ open, title, onClose, wide, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={s.overlay} role="presentation" onClick={onClose}>
      <div ref={ref} className={`${s.dialog} ${wide ? s.modalWide : ''}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className={s.cardTitle}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>{title}</span>
          <button onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---- Pagination -------------------------------- */
export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className={s.pager}>
      <span>{from}–{to} of {total}</span>
      <div className={s.pagerBtns}>
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="chevL" size={14} /></Button>
        <span style={{ alignSelf: 'center' }}>Page {page} / {pages}</span>
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}><Icon name="chevR" size={14} /></Button>
      </div>
    </div>
  );
}

/* ---- Sortable table header -------------------- */
export function Th({ children, sortKey, sort, onSort, className = '', ...rest }) {
  if (!sortKey) return <th className={className} {...rest}>{children}</th>;
  const [col, dir] = (sort || '').split('.');
  const active = col === sortKey;
  const next = active && dir === 'asc' ? `${sortKey}.desc` : `${sortKey}.asc`;
  return (
    <th data-sort className={className} onClick={() => onSort(next)} {...rest}>
      {children}{active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
}
