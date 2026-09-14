import { useState } from 'react';
import { listAllOrders } from '../lib/adminApi';
import { connectGoogleSheet, isGoogleSheetConnected, readSheet, syncOrdersToSheet } from '../lib/googleSheets';
import { useAsync } from '../hooks';
import { useToast } from '../ToastContext';
import { Badge, Button, EmptyState, ErrorState, Icon, PageHeader, Spinner } from '../components/ui';
import s from '../admin.module.css';

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
  const { data, loading, error, reload } = useAsync(
    () => (connected ? readSheet() : Promise.resolve(null)),
    [connected],
  );

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
            <Button size="sm" variant="ghost" disabled={loading} onClick={reload}>Refresh</Button>
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
        />
      ) : loading ? <Spinner label="Loading the sheet…" />
        : error ? <ErrorState error={error} onRetry={reload} />
        : !data?.rows?.length ? (
          <EmptyState
            title="The sheet is empty"
            text="Use “Sync from Supabase” to add your orders, or add a row directly in Google Sheets and refresh."
          />
        ) : (
          <div className={s.tableWrap}>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead>
                  <tr>{data.headers.map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row._row}>
                      {data.headers.map((h) => (
                        <td key={h} className={s.cellSub} style={{ maxWidth: 240 }}>{row[h] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </>
  );
}
