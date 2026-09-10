import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getOrder, setOrderStatus } from '../lib/adminApi';
import { useAsync } from '../hooks';
import { useToast } from '../ToastContext';
import { Badge, Button, ConfirmDialog, ErrorState, Money, PageHeader } from '../components/ui';
import { formatDate } from '../../lib/format';
import { statusLabel } from '../../lib/invoice';
import s from '../admin.module.css';

const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
const ALL = [...FLOW, 'cancelled'];

export default function OrderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: order, loading, error, reload } = useAsync(() => getOrder(id), [id]);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const applyStatus = async (nextStatus = pending) => {
    if (!nextStatus || nextStatus === order.status) return;
    setBusy(true);
    try {
      await setOrderStatus(id, nextStatus);
      toast.success(`Order marked ${nextStatus}${nextStatus === 'cancelled' ? ' — stock restored' : ''}`);
      setPending(null);
      reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const selectStatus = (event) => {
    const nextStatus = event.target.value;
    if (nextStatus === order.status) return;
    if (nextStatus === 'cancelled') setPending(nextStatus);
    else applyStatus(nextStatus);
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;

  const addr = order.shipping_address || {};

  return (
    <>
      <PageHeader title={`Order ${order.order_number}`} subtitle={`Placed ${formatDate(order.created_at)}`}>
        <Button variant="ghost" onClick={() => nav('/orders')}>← All orders</Button>
      </PageHeader>

      <div className={s.card} style={{ marginBottom: '1.1rem' }}>
        <div className={s.cardPad}>
          <div className={s.statusHeader}><div><div className={s.cardTitle}>Order status</div><Badge>{order.status}</Badge></div><label className={s.statusSelect}><span>Update status</span><select className={s.select} value={order.status} onChange={selectStatus} disabled={busy}>{ALL.map((st) => <option key={st} value={st}>{statusLabel(st)}</option>)}</select></label></div>
          <div className={s.orderTimeline}>{FLOW.map((st, index) => <div className={`${s.timelineStep} ${FLOW.indexOf(order.status) >= index ? s.timelineDone : ''}`} key={st}><span>{index + 1}</span><small>{statusLabel(st)}</small></div>)}</div>
          {order.status === 'cancelled' ? <p className={s.fieldHint} style={{ marginTop: '0.7rem', color: 'var(--color-cherry)' }}>Cancelled orders are returned to stock and cannot be moved back into fulfilment.</p> : <p className={s.fieldHint} style={{ marginTop: '0.7rem' }}>Status changes save immediately. Cancelling restores stock automatically.</p>}
        </div>
      </div>

      <div className={s.orderGrid}>
        <div className={s.card}>
          <div className={s.cardPad}>
            <div className={s.cardTitle}>Items</div>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead><tr><th>Product</th><th>Size</th><th className={s.num}>Unit</th><th className={s.num}>Qty</th><th className={s.num}>Line</th></tr></thead>
                <tbody>
                  {(order.items || []).map((it) => (
                    <tr key={it.id}>
                      <td><div className={s.detailProduct}>{it.product?.product_images?.[0]?.url ? <img src={it.product.product_images[0].url} alt="" className={s.thumb} /> : null}<span className={s.cellMain}>{it.name}</span></div></td>
                      <td>{it.size || '—'}</td>
                      <td className={s.num}><Money value={it.unit_price} /></td>
                      <td className={s.num}>{it.quantity}</td>
                      <td className={s.num}><Money value={Number(it.unit_price) * Number(it.quantity)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={s.kv} style={{ marginTop: '1rem', maxWidth: 320, marginLeft: 'auto' }}>
              <dt>Subtotal</dt><dd className={s.num}><Money value={order.subtotal} /></dd>
              {order.discount ? <><dt>Discount{order.coupon?.code ? ` (${order.coupon.code})` : ''}</dt><dd className={s.num}>−<Money value={order.discount} /></dd></> : null}
              <dt>Shipping</dt><dd className={s.num}>{order.shipping ? <Money value={order.shipping} /> : 'Free'}</dd>
              <dt style={{ fontWeight: 700, color: 'var(--admin-ink)' }}>Total</dt>
              <dd className={s.num} style={{ fontWeight: 700 }}><Money value={order.total} /></dd>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1.1rem' }}>
          <div className={s.card}>
            <div className={s.cardPad}>
              <div className={s.cardTitle}>Customer</div>
              <dl className={s.kv}>
                <dt>Name</dt><dd>{order.customer_name || addr.fullName || '—'}</dd>
                <dt>Email</dt><dd>{order.email || '—'}</dd>
                <dt>Phone</dt><dd>{order.phone || addr.phone || '—'}</dd>
              </dl>
            </div>
          </div>
          <div className={s.card}>
            <div className={s.cardPad}>
              <div className={s.cardTitle}>Shipping address</div>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                {[addr.address, addr.city, addr.state, addr.pincode, addr.country].filter(Boolean).join(', ') || 'No address on file'}
              </p>
              {order.notes || addr.notes ? <><div className={s.fieldLabel} style={{ marginTop: '0.7rem' }}>Order notes</div><p style={{ fontSize: '0.85rem' }}>{order.notes || addr.notes}</p></> : null}
            </div>
          </div>
          <div className={s.card}>
            <div className={s.cardPad}>
              <div className={s.cardTitle}>Payment</div>
              <dl className={s.kv}><dt>Status</dt><dd>Recorded</dd><dt>Method</dt><dd>Frontend demo</dd></dl>
              <p className={s.fieldHint} style={{ marginTop: '0.7rem' }}>No gateway payment status is stored for this order.</p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog open={!!pending}
        title={`Set status to “${pending}”?`}
        message={pending === 'cancelled' ? 'The ordered quantities will be added back to product stock.' : 'The customer will see this status on their account.'}
        confirmLabel={`Mark ${pending}`} danger={pending === 'cancelled'} busy={busy} onConfirm={() => applyStatus()} onCancel={() => setPending(null)} />
    </>
  );
}
