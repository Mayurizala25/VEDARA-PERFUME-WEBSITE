import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrder, getOrderSummary, listOrders } from '../lib/adminApi';
import { useAsync, useListParams } from '../hooks';
import { useToast } from '../ToastContext';
import { Badge, Button, EmptyState, ErrorState, Icon, Money, PageHeader, Pagination, SearchInput, Spinner, Th } from '../components/ui';
import { formatDate } from '../../lib/format';
import { downloadInvoice } from '../../lib/invoice';
import s from '../admin.module.css';

const PAGE_SIZE = 20;
const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export default function Orders() {
  const { params, raw, set } = useListParams({ sort: 'created_at.desc', dateFrom: '', dateTo: '' });
  const toast = useToast();
  const [action, setAction] = useState('');
  const { data, loading, error, reload } = useAsync(
    () => listOrders({ ...params, pageSize: PAGE_SIZE }),
    [params.search, params.status, params.sort, params.dateFrom, params.dateTo, params.page],
  );
  const { data: summary, loading: summaryLoading } = useAsync(
    () => getOrderSummary({ dateFrom: params.dateFrom, dateTo: params.dateTo }),
    [params.dateFrom, params.dateTo],
  );

  const invoiceAction = async (id, type) => {
    setAction(`${id}:${type}`);
    try {
      const order = await getOrder(id);
      if (type === 'download') await downloadInvoice(order);
      else window.open(`/admin/orders/${id}?print=1`, '_blank', 'noopener,noreferrer');
    } catch (e) { toast.error(e.message || 'Could not prepare the invoice.'); }
    finally { setAction(''); }
  };

  const metrics = [
    ['Total orders', summary?.total, 'total'],
    ['Pending', summary?.pending, 'pending'],
    ['Processing', summary?.processing, 'processing'],
    ['Shipped', summary?.shipped, 'shipped'],
    ['Delivered', summary?.delivered, 'delivered'],
    ['Cancelled', summary?.cancelled, 'cancelled'],
    ['Revenue', summary?.revenue, 'revenue'],
  ];

  return (
    <>
      <PageHeader title="Orders" subtitle="Review, fulfil and close every customer order from one place." />

      <div className={s.orderMetrics} aria-label="Order summary">
        {metrics.map(([label, value, key]) => <div className={`${s.orderMetric} ${key === 'pending' && value ? s.orderMetricAttention : ''}`} key={key}>
          <span>{label}</span><strong>{summaryLoading ? '—' : key === 'revenue' ? <Money value={value} /> : value || 0}</strong>{key === 'pending' && value ? <small>Needs attention</small> : null}
        </div>)}
      </div>

      <div className={s.toolbar}>
        <SearchInput value={raw.search} onChange={(v) => set({ search: v })} placeholder="Order, customer, phone or perfume…" />
        <select className={s.select} style={{ maxWidth: 170 }} value={raw.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUSES.map((st) => <option key={st} value={st}>{st[0].toUpperCase() + st.slice(1)}</option>)}
        </select>
        <select className={s.select} style={{ maxWidth: 190 }} value={raw.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort orders">
          <option value="created_at.desc">Newest first</option><option value="created_at.asc">Oldest first</option><option value="total.desc">Highest total</option><option value="total.asc">Lowest total</option>
        </select>
        <input className={s.input} type="date" value={raw.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} aria-label="Orders from date" />
        <input className={s.input} type="date" value={raw.dateTo} onChange={(e) => set({ dateTo: e.target.value })} aria-label="Orders to date" />
      </div>

      {loading ? <Spinner label="Loading orders…" />
        : error ? <ErrorState error={error} onRetry={reload} />
        : data.rows.length === 0 ? <EmptyState title="No orders yet" text="Orders customers place will appear here immediately." />
        : (
          <div className={s.tableWrap}>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <Th sortKey="order_number" sort={params.sort} onSort={(v) => set({ sort: v })}>Order</Th>
                    <th>Customer</th>
                    <th>Products</th>
                    <Th sortKey="created_at" sort={params.sort} onSort={(v) => set({ sort: v })}>Date</Th>
                    <Th sortKey="total" sort={params.sort} onSort={(v) => set({ sort: v })} className={s.num}>Total</Th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((o) => (
                    <tr key={o.id}>
                      <td><Link to={`/orders/${o.id}`} className={s.cellMain}>{o.order_number}</Link><div className={s.cellSub}>{o.status === 'pending' ? 'New order' : 'Order'}</div></td>
                      <td>
                        <div>{o.customer_name || '—'}</div>
                        <div className={s.cellSub}>{o.email || o.phone || 'No contact details'}</div>
                      </td>
                      <td><div className={s.productCell}>{o.first_item?.product?.product_images?.[0]?.url ? <img src={o.first_item.product.product_images[0].url} alt="" className={s.thumbSm} /> : <span className={s.productPlaceholder}><Icon name="box" size={15} /></span>}<span><strong>{o.first_item?.name || 'Order items'}</strong><small>{o.item_count} item{o.item_count === 1 ? '' : 's'}{o.item_count > (o.first_item?.quantity || 0) ? ' · multiple products' : ''}</small></span></div></td>
                      <td className={s.cellSub}>{formatDate(o.created_at)}</td>
                      <td className={s.num}><Money value={o.total} /></td>
                      <td><span className={s.paymentState}>Recorded</span></td>
                      <td><Badge>{o.status}</Badge></td>
                      <td><div className={s.orderActions}>
                        <Link to={`/orders/${o.id}`} className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}>Manage</Link>
                        <Button size="sm" variant="ghost" icon="external" title="Download invoice" aria-label={`Download invoice ${o.order_number}`} disabled={action === `${o.id}:download`} onClick={() => invoiceAction(o.id, 'download')} />
                        <Button size="sm" variant="ghost" icon="external" title="Print invoice" aria-label={`Print invoice ${o.order_number}`} disabled={action === `${o.id}:print`} onClick={() => invoiceAction(o.id, 'print')} />
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={s.mobileOrderList}>
              {data.rows.map((o) => <article className={s.mobileOrderCard} key={o.id}>
                <div className={s.mobileOrderTop}><div><Link to={`/orders/${o.id}`} className={s.cellMain}>{o.order_number}</Link><span className={s.cellSub}>{formatDate(o.created_at)}</span></div><Badge>{o.status}</Badge></div>
                <div className={s.mobileOrderCustomer}><strong>{o.customer_name || 'Guest customer'}</strong><span>{o.email || o.phone || 'No contact details'}</span></div>
                <div className={s.mobileOrderMeta}><span>{o.item_count} item{o.item_count === 1 ? '' : 's'}</span><span>Payment recorded</span><strong><Money value={o.total} /></strong></div>
                <div className={s.mobileOrderActions}><Link to={`/orders/${o.id}`} className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}>Manage order</Link><Button size="sm" variant="ghost" onClick={() => invoiceAction(o.id, 'download')}>Download invoice</Button><Button size="sm" variant="ghost" onClick={() => invoiceAction(o.id, 'print')}>Print</Button></div>
              </article>)}
            </div>
            <Pagination page={params.page} pageSize={PAGE_SIZE} total={data.count} onPage={(p) => set({ page: p })} />
          </div>
        )}
    </>
  );
}
