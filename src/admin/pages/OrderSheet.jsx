import { useEffect, useMemo, useState } from 'react';
import { listAllOrders } from '../lib/adminApi';
import { connectGoogleSheet, isGoogleSheetConnected, preloadGoogleSheets, readSheet, syncOrdersToSheet } from '../lib/googleSheets';
import { useAsync, useDebounced } from '../hooks';
import { useToast } from '../ToastContext';
import { Badge, Button, EmptyState, ErrorState, Icon, Money, PageHeader, SearchInput, Spinner } from '../components/ui';
import { formatDate } from '../../lib/format';
import s from '../admin.module.css';

const MONEY_FIELDS = new Set(['subtotal', 'discount', 'shipping', 'total']);
const DATE_FIELDS = new Set(['created_at', 'updated_at']);
const ID_FIELDS = new Set(['id', 'user_id']);
// Columns worth a spotlight on the mobile card — anything else still shows,
// just in the compact key/value list underneath.
const HIGHLIGHT_FIELDS = ['order_number', 'customer_name', 'email', 'total', 'created_at'];

function prettyHeader(key) {
  return key
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w.toLowerCase() === 'id' ? 'ID' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Typed, truncation-safe rendering for one sheet cell — same value, read
 * both in the desktop table and the mobile card. */
function Cell({ field, value }) {
  if (!value) return <span className={s.cellSub}>—</span>;
  if (field === 'status') return <Badge>{value}</Badge>;
  if (MONEY_FIELDS.has(field)) {
    const n = Number(value);
    return Number.isFinite(n) ? <Money value={n} /> : value;
  }
  if (DATE_FIELDS.has(field)) return <span>{formatDate(value) || value}</span>;
  if (ID_FIELDS.has(field)) {
    return <span title={value}>{value.length > 10 ? `${value.slice(0, 8)}…` : value}</span>;
  }
  return (
    <span title={value.length > 28 ? value : undefined} className={value.length > 28 ? s.cellSub : undefined}>
      {value.length > 60 ? `${value.slice(0, 57)}…` : value}
    </span>
  );
}

/**
 * Admin → Order Sheet. A live view of the connected Google Sheet — every
 * column and row exactly as it is in the spreadsheet — plus a one-click
 * sync that mirrors Supabase orders into it. Supabase stays the source of
 * truth for the storefront; this page is a window onto the spreadsheet
 * copy, not a replacement data store, so it never blocks on Google to load.
 */
export default function OrderSheet() {
  const toast = useToast();
  const [connected, setConnected] = useState(isGoogleSheetConnected);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [lastLoaded, setLastLoaded] = useState(null);
  const debouncedSearch = useDebounced(search, 250);

  // Fetch Google's sign-in script as soon as this page opens, well before
  // any click — a popup opened after an on-click network fetch arrives too
  // late for browsers to treat it as user-triggered, and gets silently
  // blocked. This costs nothing if the admin never connects.
  useEffect(() => { preloadGoogleSheets(); }, []);

  const { data, loading, error, reload } = useAsync(
    () => (connected ? readSheet() : Promise.resolve(null)),
    [connected],
  );

  useEffect(() => { if (data) setLastLoaded(new Date()); }, [data]);

  const rows = useMemo(() => {
    const all = data?.rows || [];
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter((row) => data.headers.some((h) => String(row[h] || '').toLowerCase().includes(q)));
  }, [data, debouncedSearch]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectGoogleSheet();
      setConnected(true);
      toast.success('Google Sheet connected.');
    } catch (e) {
      toast.error(e.message || 'Could not connect to Google.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const orders = await listAllOrders();
      if (!orders.length) { toast.error('There are no orders to sync yet.'); return; }
      const result = await syncOrdersToSheet(orders);
      toast.success(`Synced to Google Sheet — ${result.created} new, ${result.updated} updated.`);
      reload();
    } catch (e) {
      toast.error(e.message || 'Sync failed.');
    } finally {
      setSyncing(false);
      setConnected(isGoogleSheetConnected()); // reflects an expired/revoked token, if that's what failed
    }
  };

  return (
    <>
      <PageHeader title="Order Sheet" subtitle="A live view of your Google Sheet, kept in sync with Supabase orders.">
        {connected ? (
          <>
            <Badge tone="green"><Icon name="sheet" size={13} /> Google Sheet Connected</Badge>
            <Button size="sm" variant="ghost" disabled={loading} onClick={reload}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
            <Button size="sm" variant="primary" disabled={syncing} onClick={handleSync}>{syncing ? 'Syncing…' : 'Sync from Supabase'}</Button>
          </>
        ) : (
          <Button size="sm" variant="primary" disabled={connecting} onClick={handleConnect}>{connecting ? 'Connecting…' : 'Connect Google Sheet'}</Button>
        )}
      </PageHeader>

      {!connected ? (
        <EmptyState
          title="Not connected yet"
          text="Click “Connect Google Sheet” and sign in with a Google account that has edit access to the sheet."
          action={<Button variant="primary" disabled={connecting} onClick={handleConnect}>{connecting ? 'Connecting…' : 'Connect Google Sheet'}</Button>}
        />
      ) : loading && !data ? <Spinner label="Loading the sheet…" />
        : error ? <ErrorState error={error} onRetry={reload} />
        : !data?.rows?.length ? (
          <EmptyState
            title="The sheet is empty"
            text="Use “Sync from Supabase” to add your orders, or add a row directly in Google Sheets and refresh."
          />
        ) : (
          <>
            <div className={s.toolbar}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search this sheet…" />
              <span className={s.cellSub} style={{ whiteSpace: 'nowrap' }}>
                {rows.length} of {data.rows.length} row{data.rows.length === 1 ? '' : 's'}
                {lastLoaded ? ` · loaded ${lastLoaded.toLocaleTimeString('en-IN')}` : ''}
              </span>
            </div>

            {rows.length === 0 ? (
              <EmptyState title="No rows match your search" text="Try a different search term." />
            ) : (
              <div className={s.tableWrap}>
                <div className={s.tableScroll}>
                  <table className={s.table}>
                    <thead>
                      <tr>{data.headers.map((h) => <th key={h} title={h}>{prettyHeader(h)}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row._row}>
                          {data.headers.map((h) => (
                            <td key={h} className={MONEY_FIELDS.has(h) ? s.num : undefined}>
                              <Cell field={h} value={row[h]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={s.mobileOrderList}>
                  {rows.map((row) => {
                    const title = row.order_number || (row.id ? row.id.slice(0, 8) : data.headers[0] && row[data.headers[0]]) || `Row ${row._row}`;
                    const rest = data.headers.filter((h) => !['order_number', 'id', 'status'].includes(h) && !HIGHLIGHT_FIELDS.includes(h) && row[h]);
                    return (
                      <article className={s.mobileOrderCard} key={row._row}>
                        <div className={s.mobileOrderTop}>
                          <span className={s.cellMain}>{title}</span>
                          {row.status ? <Badge>{row.status}</Badge> : null}
                        </div>
                        {row.customer_name || row.email ? (
                          <div className={s.mobileOrderCustomer}>
                            <strong>{row.customer_name || 'No name on file'}</strong>
                            <span>{row.email || '—'}</span>
                          </div>
                        ) : null}
                        {row.total || row.created_at ? (
                          <div className={s.mobileOrderMeta}>
                            {row.created_at ? <span>{formatDate(row.created_at) || row.created_at}</span> : <span />}
                            {row.total ? <strong><Cell field="total" value={row.total} /></strong> : null}
                          </div>
                        ) : null}
                        {rest.length ? (
                          <dl className={s.kv} style={{ marginTop: '0.7rem' }}>
                            {rest.map((h) => (
                              <div key={h} style={{ display: 'contents' }}>
                                <dt>{prettyHeader(h)}</dt>
                                <dd><Cell field={h} value={row[h]} /></dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
    </>
  );
}
