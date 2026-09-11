import { useState } from 'react';
import { getOrderSummary, listOrders, setOrderStatus, updateOrderContact } from '../lib/adminApi';
import { mirrorOrderToSheet, pullOrdersFromSheet, syncOrdersToSheet } from '../lib/sheetOrdersApi';
import { useAsync, useListParams } from '../hooks';
import { useToast } from '../ToastContext';
import { Badge, Button, EmptyState, ErrorState, Field, Modal, Money, PageHeader, Pagination, SearchInput, Spinner, Th } from '../components/ui';
import { formatDate } from '../../lib/format';
import s from '../admin.module.css';

const PAGE_SIZE = 20;
const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

function itemsLine(order) {
  return (order.items || []).map((it) => (it.quantity > 1 ? `${it.name} x${it.quantity}` : it.name)).join(', ');
}

function addressLine(order) {
  const a = order.shipping_address || {};
  return [a.address, a.city, a.state, a.pincode, a.country].filter(Boolean).join(', ');
}

/**
 * Admin → Sheet Orders. The real Supabase orders (same data as the Orders
 * page), kept two-way synced with the "VEDARA Orders" Google Sheet.
 * Payment is always Cash on Delivery — this storefront has no payment
 * gateway, so there is no other payment_method in Supabase to show.
 */
export default function SheetOrders() {
  const toast = useToast();
  const { params, raw, set } = useListParams({ sort: 'created_at.desc', dateFrom: '', dateTo: '' });
  const { data, loading, error, reload } = useAsync(
    () => listOrders({ ...params, pageSize: PAGE_SIZE }),
    [params.search, params.status, params.sort, params.dateFrom, params.dateTo, params.page],
  );
  const { data: summary } = useAsync(() => getOrderSummary({}), []);

  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);

  const openEdit = (order) => {
    setEdit(order);
    setForm({ status: order.status, customer_name: order.customer_name || '', email: order.email || '', phone: order.phone || '', notes: order.notes || '' });
  };

  const save = async () => {
    if (!edit || !form) return;
    setSaving(true);
    try {
      if (form.status !== edit.status) await setOrderStatus(edit.id, form.status);
      const contactPatch = {};
      for (const key of ['customer_name', 'email', 'phone', 'notes']) {
        if (form[key] !== (edit[key] || '')) contactPatch[key] = form[key];
      }
      if (Object.keys(contactPatch).length) await updateOrderContact(edit.id, contactPatch);
      await mirrorOrderToSheet(edit.id);
      toast.success(`${edit.order_number} saved and mirrored to the sheet`);
      setEdit(null);
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not save this order.');
    } finally { setSaving(false); }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const r = await syncOrdersToSheet();
      toast.success(`Sheet updated — ${r.total} order${r.total === 1 ? '' : 's'} (${r.created} new, ${r.updated} updated).`);
    } catch (e) { toast.error(e.message || 'Could not sync to the sheet.'); }
    finally { setSyncing(false); }
  };

  const runPull = async () => {
    setPulling(true);
    try {
      const r = await pullOrdersFromSheet();
      toast.success(r.updated ? `Pulled ${r.updated} change${r.updated === 1 ? '' : 's'} from the sheet.` : 'No changes found in the sheet.');
      reload();
    } catch (e) { toast.error(e.message || 'Could not read the sheet.'); }
    finally { setPulling(false); }
  };

  return (
    <>
      <PageHeader title="Sheet Orders" subtitle="Your real Supabase orders, kept in sync with the “VEDARA Orders” Google Sheet.">
        <Button variant="ghost" disabled={pulling} onClick={runPull}>{pulling ? 'Reading sheet…' : 'Refresh from Sheet'}</Button>
        <Button variant="primary" disabled={syncing} onClick={runSync}>{syncing ? 'Syncing…' : 'Sync to Sheet'}</Button>
      </PageHeader>

      {summary ? (
        <div className={s.orderMetrics} aria-label="Order summary">
          {[['Total orders', summary.total], ['Pending', summary.pending], ['Processing', summary.processing], ['Shipped', summary.shipped], ['Delivered', summary.delivered], ['Revenue', summary.revenue, true]].map(([label, value, money]) => (
            <div className={s.orderMetric} key={label}><span>{label}</span><strong>{money ? <Money value={value} /> : value || 0}</strong></div>
          ))}
        </div>
      ) : null}

      <div className={s.toolbar}>
        <SearchInput value={raw.search} onChange={(v) => set({ search: v })} placeholder="Order, customer, phone or perfume…" />
        <select className={s.select} style={{ maxWidth: 170 }} value={raw.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUSES.map((st) => <option key={st} value={st}>{st[0].toUpperCase() + st.slice(1)}</option>)}
        </select>
        <select className={s.select} style={{ maxWidth: 190 }} value={raw.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort orders">
          <option value="created_at.desc">Newest first</option><option value="created_at.asc">Oldest first</option><option value="total.desc">Highest total</option><option value="total.asc">Lowest total</option>
        </select>
      </div>

      {loading ? <Spinner label="Loading orders…" />
        : error ? <ErrorState error={error} onRetry={reload} />
        : data.rows.length === 0 ? <EmptyState title="No orders yet" text="Orders customers place will appear here." />
        : (
          <div className={s.tableWrap}>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <Th sortKey="order_number" sort={params.sort} onSort={(v) => set({ sort: v })}>Order</Th>
                    <th>Customer</th>
                    <th>Order</th>
                    <th>Shipping address</th>
                    <th className={s.num}>Subtotal</th>
                    <th className={s.num}>Discount</th>
                    <th className={s.num}>Shipping</th>
                    <Th sortKey="total" sort={params.sort} onSort={(v) => set({ sort: v })} className={s.num}>Total</Th>
                    <th>Payment</th>
                    <th>Status</th>
                    <Th sortKey="created_at" sort={params.sort} onSort={(v) => set({ sort: v })}>Created</Th>
                    <th>Updated</th>
                    <th>Notes</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((o) => (
                    <tr key={o.id}>
                      <td><span className={s.cellMain}>{o.order_number}</span><div className={s.cellSub} title={o.id}>{o.id.slice(0, 8)}…</div></td>
                      <td>
                        <div>{o.customer_name || '—'}</div>
                        <div className={s.cellSub}>{o.email || '—'}</div>
                        <div className={s.cellSub}>{o.phone || '—'}</div>
                        {o.user_id ? <div className={s.cellSub} title={o.user_id}>{o.user_id.slice(0, 8)}…</div> : null}
                      </td>
                      <td className={s.cellSub} style={{ maxWidth: 220 }}>{itemsLine(o) || '—'}</td>
                      <td className={s.cellSub} style={{ maxWidth: 220 }}>{addressLine(o) || '—'}</td>
                      <td className={s.num}><Money value={o.subtotal} /></td>
                      <td className={s.num}>{o.discount ? <Money value={o.discount} /> : '—'}</td>
                      <td className={s.num}>{o.shipping ? <Money value={o.shipping} /> : 'Free'}</td>
                      <td className={s.num}><Money value={o.total} /></td>
                      <td><div>COD</div><div className={s.cellSub}>{o.status === 'delivered' ? 'Collected' : 'Due on delivery'}</div></td>
                      <td><Badge>{o.status}</Badge></td>
                      <td className={s.cellSub}>{formatDate(o.created_at)}</td>
                      <td className={s.cellSub}>{formatDate(o.updated_at)}</td>
                      <td className={s.cellSub} style={{ maxWidth: 160 }}>{o.notes || '—'}</td>
                      <td><Button size="sm" variant="ghost" onClick={() => openEdit(o)}>Edit</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={params.page} pageSize={PAGE_SIZE} total={data.count} onPage={(p) => set({ page: p })} />
          </div>
        )}

      <Modal open={!!edit} title={edit ? `Edit ${edit.order_number}` : ''} onClose={() => setEdit(null)}>
        {form ? (
          <div className={s.form}>
            <Field label="Status">
              <select className={s.select} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {STATUSES.map((st) => <option key={st} value={st}>{st[0].toUpperCase() + st.slice(1)}</option>)}
              </select>
            </Field>
            <div className={s.formGrid}>
              <Field label="Customer name"><input className={s.input} value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} /></Field>
              <Field label="Phone"><input className={s.input} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
            </div>
            <Field label="Email"><input className={s.input} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Notes"><textarea className={s.input} rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
            <p className={s.fieldHint}>Saving updates Supabase and mirrors this order to its row in the Google Sheet. Totals, address and order number aren’t editable here — see the main Orders page.</p>
            <div className={s.dialogActions}>
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              <Button variant="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
