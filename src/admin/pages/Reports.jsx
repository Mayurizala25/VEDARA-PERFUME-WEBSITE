import { useEffect, useMemo, useState } from 'react';
import { ErrorState, PageHeader, Spinner, SearchInput, Button, EmptyState, Money } from '../components/ui';
import { getReportsDashboard, listReportRows } from '../lib/adminApi';
import s from '../admin.module.css';

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function Reports() {
  const [range, setRange] = useState('this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dump, setDump] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const params = useMemo(() => ({
    period: range,
    dateFrom,
    dateTo,
    search,
    page,
    pageSize: 8,
  }), [range, dateFrom, dateTo, search, page]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getReportsDashboard(params),
      listReportRows(params),
    ])
      .then(([dashboard, rows]) => {
        if (!alive) return;
        setDump({ dashboard, rows });
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [params]);

  const exportCsv = () => {
    const rowData = Array.isArray(dump?.rows?.rows)
      ? dump.rows.rows
      : Array.isArray(dump?.rows)
        ? dump.rows
        : [];
    if (!rowData.length) return;

    const headers = ['Date', 'Orders', 'Products Sold', 'Revenue', 'Discount', 'Shipping', 'Net Total'];
    const rows = rowData.map((r) => [r.date, r.orders, r.products_sold, r.revenue, r.discount, r.shipping, r.net_total]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vedara-reports-${range}-${todayIso()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const rowData = Array.isArray(dump?.rows?.rows)
      ? dump.rows.rows
      : Array.isArray(dump?.rows)
        ? dump.rows
        : [];
    if (!rowData.length) return;
    window.print();
  };

  if (loading) return <Spinner label="Loading reports…" />;
  if (error) return <ErrorState error={error} onRetry={() => setPage(1)} />;

  const dashboard = dump?.dashboard || {};
  const rows = dump?.rows?.rows || dump?.rows || [];
  const count = dump?.rows?.count || rows.length || 0;

  return (
    <>
      <PageHeader title="Reports" subtitle="Business performance from live orders, products, customers and inventory.">
        <div className={s.pageActions}>
          <Button variant="ghost" onClick={printReport}>Print</Button>
          <Button variant="primary" onClick={exportCsv}>Export CSV</Button>
        </div>
      </PageHeader>

      <section className={s.reportFilters}>
        <select className={s.select} value={range} onChange={(e) => { setRange(e.target.value); setPage(1); }}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="year">This Year</option>
          <option value="custom">Custom Date Range</option>
        </select>
        {range === 'custom' ? (
          <>
            <input className={s.input} type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            <input className={s.input} type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </>
        ) : null}
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search report tables" />
      </section>

      <section className={s.cardGrid}>
        <div className={s.summaryCard}><span>Total Orders</span><strong>{dashboard.total_orders ?? 0}</strong></div>
        <div className={s.summaryCard}><span>Total Revenue</span><strong><Money value={dashboard.total_revenue ?? 0} /></strong></div>
        <div className={s.summaryCard}><span>Paid Revenue</span><strong><Money value={dashboard.paid_revenue ?? 0} /></strong></div>
        <div className={s.summaryCard}><span>Pending Orders</span><strong>{dashboard.pending_orders ?? 0}</strong></div>
        <div className={s.summaryCard}><span>Processing Orders</span><strong>{dashboard.processing_orders ?? 0}</strong></div>
        <div className={s.summaryCard}><span>Shipped Orders</span><strong>{dashboard.shipped_orders ?? 0}</strong></div>
        <div className={s.summaryCard}><span>Delivered Orders</span><strong>{dashboard.delivered_orders ?? 0}</strong></div>
        <div className={s.summaryCard}><span>Cancelled Orders</span><strong>{dashboard.cancelled_orders ?? 0}</strong></div>
        <div className={s.summaryCard}><span>Total Products Sold</span><strong>{dashboard.total_products_sold ?? 0}</strong></div>
        <div className={s.summaryCard}><span>Average Order Value</span><strong><Money value={dashboard.average_order_value ?? 0} /></strong></div>
        <div className={s.summaryCard}><span>Total Discounts</span><strong><Money value={dashboard.total_discounts ?? 0} /></strong></div>
        <div className={s.summaryCard}><span>Total Shipping</span><strong><Money value={dashboard.total_shipping ?? 0} /></strong></div>
      </section>

      <section className={s.reportTableWrap}>
        <div className={s.tableScroll}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Date</th><th>Orders</th><th>Products Sold</th><th>Revenue</th><th>Discount</th><th>Shipping</th><th>Net Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan="7"><EmptyState title="No report rows" text="No orders matched that period." /></td></tr> : rows.map((r, i) => (
                <tr key={`${r.date}-${i}`}>
                  <td>{r.date}</td>
                  <td className={s.num}>{r.orders}</td>
                  <td className={s.num}>{r.products_sold}</td>
                  <td><Money value={r.revenue} /></td>
                  <td><Money value={r.discount} /></td>
                  <td><Money value={r.shipping} /></td>
                  <td><Money value={r.net_total} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={s.reportExtra}>
        <div className={s.card}><h3>Sales</h3><div className={s.kv}><span>Revenue</span><strong><Money value={dashboard.total_revenue ?? 0} /></strong></div></div>
        <div className={s.card}><h3>Products</h3><div className={s.kv}><span>Best sellers</span><strong>{dashboard.best_seller || '—'}</strong></div></div>
        <div className={s.card}><h3>Customers</h3><div className={s.kv}><span>Customers</span><strong>{dashboard.total_customers ?? 0}</strong></div></div>
        <div className={s.card}><h3>Inventory</h3><div className={s.kv}><span>Low stock</span><strong>{dashboard.low_stock ?? 0}</strong></div></div>
      </section>

      <div className={s.pager}>
        <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
        <span>Page {page}</span>
        <Button variant="ghost" disabled={rows.length < 8} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </>
  );
}
