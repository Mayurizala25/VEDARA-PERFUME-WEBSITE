import { useState } from 'react';
import { getCustomer, listCustomers, setCustomerStatus } from '../lib/adminApi';
import { useAsync, useListParams } from '../hooks';
import { useToast } from '../ToastContext';
import { Badge, Button, EmptyState, ErrorState, Modal, Money, PageHeader, Pagination, SearchInput, Spinner, Th } from '../components/ui';
import { formatDate } from '../../lib/format';
import s from '../admin.module.css';

const PAGE_SIZE = 20;

export default function Customers() {
  const toast = useToast();
  const { params, raw, set } = useListParams({ sort: 'created_at.desc' });
  const { data, loading, error, reload } = useAsync(
    () => listCustomers({ ...params, pageSize: PAGE_SIZE }),
    [params.search, params.sort, params.page],
  );
  const [view, setView] = useState(null);

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone who has created a VEDARA account." />

      <div className={s.toolbar}>
        <SearchInput value={raw.search} onChange={(v) => set({ search: v })} placeholder="Name, email or phone…" />
      </div>

      {loading ? <Spinner label="Loading customers…" />
        : error ? <ErrorState error={error} onRetry={reload} />
        : data.rows.length === 0 ? <EmptyState title="No customers yet" text="Accounts appear here as soon as someone signs up." />
        : (
          <div className={s.tableWrap}>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <Th sortKey="full_name" sort={params.sort} onSort={(v) => set({ sort: v })}>Name</Th>
                    <th>Contact</th>
                    <th className={s.num}>Orders</th>
                    <th className={s.num}>Total spend</th>
                    <th>Status</th>
                    <Th sortKey="created_at" sort={params.sort} onSort={(v) => set({ sort: v })}>Joined</Th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((c) => (
                    <tr key={c.id}>
                      <td className={s.cellMain}>{c.full_name || '—'}{c.is_admin ? <Badge tone="cherry">Admin</Badge> : null}</td>
                      <td><div>{c.email}</div><div className={s.cellSub}>{c.phone || 'No phone'}</div></td>
                      <td className={s.num}>{c.orders_count}</td>
                      <td className={s.num}><Money value={c.total_spend} /></td>
                      <td><Badge>{c.status || 'active'}</Badge></td>
                      <td className={s.cellSub}>{formatDate(c.created_at)}</td>
                      <td><Button size="sm" variant="ghost" onClick={() => setView(c.id)}>View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={params.page} pageSize={PAGE_SIZE} total={data.count} onPage={(p) => set({ page: p })} />
          </div>
        )}

      {view ? <CustomerModal id={view} onClose={() => setView(null)} onChanged={reload} toast={toast} /> : null}
    </>
  );
}

function CustomerModal({ id, onClose, onChanged, toast }) {
  const { data, loading, error } = useAsync(() => getCustomer(id), [id]);
  const [busy, setBusy] = useState(false);

  const toggleStatus = async () => {
    const next = data.profile.status === 'suspended' ? 'active' : 'suspended';
    setBusy(true);
    try {
      await setCustomerStatus(id, next);
      toast.success(`Account ${next}`);
      onChanged();
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open title="Customer" onClose={onClose} wide>
      {loading ? <Spinner /> : error ? <ErrorState error={error} /> : (
        <>
          <dl className={s.kv} style={{ marginBottom: '1rem' }}>
            <dt>Name</dt><dd>{data.profile.full_name || '—'}</dd>
            <dt>Email</dt><dd>{data.profile.email}</dd>
            <dt>Phone</dt><dd>{data.profile.phone || '—'}</dd>
            <dt>Joined</dt><dd>{formatDate(data.profile.created_at)}</dd>
            <dt>Status</dt><dd><Badge>{data.profile.status || 'active'}</Badge></dd>
          </dl>

          <div className={s.cardTitle}>Order history ({data.orders.length})</div>
          {data.orders.length ? (
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead><tr><th>Order</th><th>Status</th><th className={s.num}>Items</th><th className={s.num}>Total</th><th>Date</th></tr></thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.order_number}</td>
                      <td><Badge>{o.status}</Badge></td>
                      <td className={s.num}>{(o.order_items || []).reduce((n, i) => n + i.quantity, 0)}</td>
                      <td className={s.num}><Money value={o.total} /></td>
                      <td className={s.cellSub}>{formatDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className={s.cellSub}>No orders yet.</p>}

          <div className={s.dialogActions}>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button variant={data.profile.status === 'suspended' ? 'primary' : 'danger'} disabled={busy} onClick={toggleStatus}>
              {data.profile.status === 'suspended' ? 'Reactivate account' : 'Suspend account'}
            </Button>
          </div>
          <p className={s.fieldHint}>Suspending flags the account for your reference; blocking sign-in also needs an auth hook.</p>
        </>
      )}
    </Modal>
  );
}
