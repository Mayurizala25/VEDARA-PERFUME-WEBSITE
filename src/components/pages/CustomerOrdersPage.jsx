import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Container from '../layout/Container';
import Button from '../ui/Button';
import { getMyOrder, getMyOrders } from '../../lib/orders';
import { orderAddress, orderImage, orderItems, statusLabel } from '../../lib/invoice';
import { formatDate, formatPrice } from '../../lib/format';
import s from './CustomerOrdersPage.module.css';

const FILTERS = ['', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

function Status({ value }) {
  return <span className={`${s.status} ${s[`status${value}`] || ''}`}>{statusLabel(value)}</span>;
}

export function CustomerOrdersPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) window.location.href = '/login?redirect=/account/orders';
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let alive = true;
    getMyOrders().then((data) => { if (alive) setOrders(data); }).catch((err) => { if (alive) setError(err.message || 'Could not load your orders.'); });
    return () => { alive = false; };
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated) return null;
  const query = search.trim().toLowerCase();
  const visible = (orders || []).filter((order) => {
    if (filter && order.status !== filter) return false;
    if (!query) return true;
    return [order.order_number, ...(order.order_items || []).map((item) => item.name)].filter(Boolean).some((value) => value.toLowerCase().includes(query));
  });

  return <main className={s.page}><Container>
    <div className={s.pageHead}><p className={s.eyebrow}>Your VEDARA</p><h1>My orders</h1><p>Every fragrance journey, gathered in one place.</p></div>
    <div className={s.controls}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order or perfume" aria-label="Search orders" /><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter orders"><option value="">All orders</option>{FILTERS.slice(1).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></div>
    {error ? <div className={s.error} role="alert">{error}</div> : orders === null ? <p className={s.state}>Loading your orders...</p> : visible.length === 0 ? <div className={s.empty}><h2>{orders.length ? 'No matching orders' : 'No orders yet'}</h2><p>{orders.length ? 'Try another search or filter.' : 'Your first VEDARA order will appear here.'}</p><Button as="a" href="/shop" variant="primary">Explore fragrances</Button></div> : <div className={s.orderList}>{visible.map((order) => <a className={s.orderCard} href={`/account/orders/${order.id}`} key={order.id}><div><span className={s.orderNumber}>{order.order_number}</span><span className={s.orderDate}>{formatDate(order.created_at)}</span></div><div><span>{(order.order_items || []).reduce((total, item) => total + item.quantity, 0)} item(s)</span><span>Payment recorded</span><Status value={order.status} /><strong>{formatPrice(order.total || 0)}</strong></div></a>)}</div>}
  </Container></main>;
}

export function CustomerOrderDetailPage({ id }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) window.location.href = `/login?redirect=/account/orders/${id}`;
  }, [authLoading, isAuthenticated, id]);

  useEffect(() => {
    if (!isAuthenticated || !id) return undefined;
    let alive = true;
    getMyOrder(id)
      .then((data) => { if (alive) setOrder(data); })
      .catch((err) => {
        if (alive) {
          const friendly = err?.message === 'ORDER_NOT_FOUND'
            ? 'This order link is invalid or the order does not belong to this account.'
            : err?.message || 'Could not load this order.';
          setError(friendly);
        }
      });
    return () => { alive = false; };
  }, [isAuthenticated, id]);

  if (authLoading || !isAuthenticated) return null;
  if (error) return <main className={s.page}><Container><div className={s.error} role="alert">{error}</div><Button as="a" href="/account/orders" variant="secondary">Back to orders</Button></Container></main>;
  if (!order) return null;

  const address = orderAddress(order);
  return <main className={s.page}><Container>
    <div className={s.detailHead}><div><a className={s.back} href="/account/orders">Back to orders</a><p className={s.eyebrow}>Order details</p><div className={s.orderIdentity}><h1>{order.order_number || order.id}</h1><span className={s.metaDate}>Placed {formatDate(order.created_at)}</span><span className={s.metaStatus}><Status value={order.status} /></span></div></div></div>
    <div className={s.detailGrid}><section className={s.panel}><h2>Ordered perfumes</h2><div className={s.items}>{orderItems(order).map((item) => <div className={s.item} key={item.id || `${item.name}-${item.size}-${item.quantity}`}><img src={orderImage(item) || '/images/product.jpg'} alt={item.name || item.product?.name || ''} /><div><h3>{item.name || item.product?.name}</h3><p>Size: {item.size || 'Standard size'} · Qty: {item.quantity} · Price: {formatPrice(Number(item.unit_price) || 0)}</p></div><strong>{formatPrice((Number(item.unit_price) || 0) * item.quantity)}</strong></div>)}</div><dl className={s.totals}><dt>Subtotal</dt><dd>{formatPrice(order.subtotal || 0)}</dd><dt>Discount</dt><dd>{order.discount ? `-${formatPrice(order.discount)}` : formatPrice(0)}</dd><dt>Shipping</dt><dd>{order.shipping ? formatPrice(order.shipping) : 'Free'}</dd><dt className={s.grand}>Total</dt><dd className={s.grand}>{formatPrice(order.total || 0)}</dd></dl></section><aside className={s.side}><section className={s.panel}><h2>Customer + shipping details</h2><p><strong>{order.customer_name || address.fullName || 'VEDARA customer'}</strong><br />{order.email}<br />{order.phone || address.phone || ''}</p><p>{[address.address, address.city, address.state, address.pincode, address.country].filter(Boolean).join(', ') || 'Address not stored'}</p></section><section className={s.panel}><h2>Payment status</h2><p>Payment status: Recorded</p><p>Order status: {statusLabel(order.status)}</p>{order.notes || address.notes ? <p>Notes: {order.notes || address.notes}</p> : null}</section></aside></div>
  </Container></main>;
}
