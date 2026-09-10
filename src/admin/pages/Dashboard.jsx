import { Link } from 'react-router-dom';
import { getBestSellers, getDashboardStats, getRecentCustomers, getRecentOrders, getSalesOverview } from '../lib/adminApi';
import { useAsync } from '../hooks';
import { Badge, Button, ErrorState, Money, PageHeader, Spinner } from '../components/ui';
import { formatDate } from '../../lib/format';
import s from '../admin.module.css';

function Stat({ label, value, sub, tone }) {
  return (
    <div className={s.stat}>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statValue}>{value}</div>
      {sub ? <div className={s.statSub} data-tone={tone}>{sub}</div> : null}
    </div>
  );
}

function SalesChart({ data }) {
  const max = Math.max(1, ...data.map((d) => Number(d.revenue) || 0));
  return (
    <>
      <div className={s.chart}>
        {data.map((d) => (
          <div key={d.date} className={s.bar}
            style={{ height: `${((Number(d.revenue) || 0) / max) * 100}%` }}
            title={`${formatDate(d.date)} — ₹${Number(d.revenue).toLocaleString('en-IN')} · ${d.orders} order${d.orders === 1 ? '' : 's'}`} />
        ))}
      </div>
      <div className={s.chartAxis}>
        <span>{data.length ? formatDate(data[0].date) : ''}</span>
        <span>Today</span>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => Promise.all([
    getDashboardStats(), getSalesOverview(30), getBestSellers(5), getRecentOrders(6), getRecentCustomers(5),
  ]).then(([stats, sales, best, orders, customers]) => ({ stats, sales, best, orders, customers })));

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { stats, sales, best, orders, customers } = data;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live figures straight from the database.">
        <Button variant="ghost" icon="settings" onClick={reload}>Refresh</Button>
      </PageHeader>

      <div className={s.statGrid}>
        <Stat label="Revenue (all time)" value={<Money value={stats.revenue} />} sub={`₹${Number(stats.revenue_30d || 0).toLocaleString('en-IN')} in the last 30 days`} />
        <Stat label="Orders" value={stats.orders_total || 0} sub={`${stats.orders_pending || 0} awaiting fulfilment`} tone={stats.orders_pending ? 'warn' : undefined} />
        <Stat label="Products" value={stats.products_total || 0} sub={`${stats.products_active || 0} active`} />
        <Stat label="Customers" value={stats.customers_total || 0} sub={`${stats.customers_30d || 0} new this month`} />
        <Stat label="Low stock" value={stats.low_stock || 0} sub={stats.low_stock ? 'Restock soon' : 'All healthy'} tone={stats.low_stock ? 'warn' : undefined} />
        <Stat label="Out of stock" value={stats.out_of_stock || 0} sub={stats.out_of_stock ? 'Not buyable right now' : 'None'} tone={stats.out_of_stock ? 'bad' : undefined} />
        <Stat label="Reviews to moderate" value={stats.reviews_pending || 0} tone={stats.reviews_pending ? 'warn' : undefined} />
        <Stat label="New enquiries" value={stats.enquiries_new || 0} tone={stats.enquiries_new ? 'warn' : undefined} />
      </div>

      <div className={s.dashGrid}>
        <div className={s.card}>
          <div className={s.cardPad}>
            <div className={s.cardTitle}><span>Sales — last 30 days</span></div>
            <SalesChart data={sales} />
          </div>
        </div>
        <div className={s.card}>
          <div className={s.cardPad}>
            <div className={s.cardTitle}><span>Best sellers</span><Link to="/products" className={s.cellSub}>All products →</Link></div>
            {best.length ? (
              <table className={s.table} style={{ fontSize: '0.8rem' }}>
                <tbody>
                  {best.map((b) => (
                    <tr key={b.product_id || b.name}>
                      <td style={{ padding: '0.45rem 0' }}>{b.slug ? <Link to={`/products/${b.product_id}/edit`}>{b.name}</Link> : b.name}</td>
                      <td className={s.num} style={{ padding: '0.45rem 0' }}>{b.units} sold</td>
                      <td className={s.num} style={{ padding: '0.45rem 0' }}><Money value={b.revenue} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className={s.cellSub}>No sales yet.</p>}
          </div>
        </div>
      </div>

      <div className={s.dashGrid}>
        <div className={s.card}>
          <div className={s.cardPad}>
            <div className={s.cardTitle}><span>Recent orders</span><Link to="/orders" className={s.cellSub}>All orders →</Link></div>
            {orders.length ? (
              <div className={s.tableScroll}>
                <table className={s.table} style={{ fontSize: '0.8rem' }}>
                  <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className={s.num}>Total</th><th>Date</th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td><Link to={`/orders/${o.id}`}>{o.order_number}</Link></td>
                        <td>{o.customer_name || o.email || '—'}</td>
                        <td><Badge>{o.status}</Badge></td>
                        <td className={s.num}><Money value={o.total} /></td>
                        <td className={s.cellSub}>{formatDate(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className={s.cellSub}>No orders yet.</p>}
          </div>
        </div>
        <div className={s.card}>
          <div className={s.cardPad}>
            <div className={s.cardTitle}><span>Recent customers</span><Link to="/customers" className={s.cellSub}>All customers →</Link></div>
            {customers.length ? (
              <table className={s.table} style={{ fontSize: '0.8rem' }}>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td style={{ padding: '0.45rem 0' }}><Link to={`/customers`}>{c.full_name || c.email}</Link><div className={s.cellSub}>{c.email}</div></td>
                      <td className={s.num} style={{ padding: '0.45rem 0' }} >{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className={s.cellSub}>No customers yet.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
