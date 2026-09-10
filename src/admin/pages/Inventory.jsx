import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInventory, updateStock } from '../lib/adminApi';
import { useAsync, useListParams } from '../hooks';
import { useToast } from '../ToastContext';
import { Badge, Button, EmptyState, ErrorState, Money, PageHeader, Pagination, SearchInput, Spinner, Th } from '../components/ui';
import s from '../admin.module.css';

const PAGE_SIZE = 30;

function stockTone(n) {
  if (n === 0) return { tone: 'red', label: 'Out of stock' };
  if (n <= 5) return { tone: 'amber', label: 'Low stock' };
  return { tone: 'green', label: 'In stock' };
}

export default function Inventory() {
  const toast = useToast();
  const { params, raw, set } = useListParams({ sort: 'stock.asc' });
  const { data, loading, error, reload } = useAsync(
    () => listInventory({ ...params, pageSize: PAGE_SIZE }),
    [params.search, params.filter, params.sort, params.page],
  );

  return (
    <>
      <PageHeader title="Inventory" subtitle="Update stock inline — it takes effect on the store instantly." />

      <div className={s.toolbar}>
        <SearchInput value={raw.search} onChange={(v) => set({ search: v })} placeholder="Product or SKU…" />
        <select className={s.select} style={{ maxWidth: 170 }} value={raw.filter} onChange={(e) => set({ filter: e.target.value })}>
          <option value="">All products</option>
          <option value="low">Low stock (1–5)</option>
          <option value="out">Out of stock</option>
        </select>
      </div>

      {loading ? <Spinner label="Loading inventory…" />
        : error ? <ErrorState error={error} onRetry={reload} />
        : data.rows.length === 0 ? <EmptyState title="Nothing to show" text="No products match this filter." />
        : (
          <div className={s.tableWrap}>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <Th sortKey="name" sort={params.sort} onSort={(v) => set({ sort: v })}>Product</Th>
                    <th>SKU</th>
                    <th className={s.num}>Price</th>
                    <Th sortKey="stock" sort={params.sort} onSort={(v) => set({ sort: v })} className={s.num}>Stock</Th>
                    <th>State</th>
                    <th style={{ width: 200 }}>Update</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const st = stockTone(row.stock ?? 0);
                    return (
                      <tr key={row.id}>
                        <td>
                          <Link to={`/products/${row.id}/edit`} className={s.cellMain}>{row.name}</Link>
                          <div className={s.cellSub}>{[row.gender, row.status].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td className={s.cellSub}>{row.sku || '—'}</td>
                        <td className={s.num}><Money value={row.price} /></td>
                        <td className={s.num} style={{ fontWeight: 700 }}>{row.stock ?? 0}</td>
                        <td><Badge tone={st.tone}>{st.label}</Badge></td>
                        <td><StockEditor id={row.id} value={row.stock ?? 0} onSaved={(v) => { toast.success(`${row.name} → ${v} in stock`); reload(); }} onError={(m) => toast.error(m)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={params.page} pageSize={PAGE_SIZE} total={data.count} onPage={(p) => set({ page: p })} />
          </div>
        )}
    </>
  );
}

function StockEditor({ id, value, onSaved, onError }) {
  const [v, setV] = useState(String(value));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setV(String(value)); }, [value]);
  const dirty = String(value) !== v;

  const save = async () => {
    setSaving(true);
    try { const n = await updateStock(id, v); onSaved(n); }
    catch (e) { onError(e.message); setV(String(value)); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', gap: '0.4rem' }}>
      <input className={s.input} type="number" min="0" style={{ width: 80 }} value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && dirty && save()} />
      <Button size="sm" variant={dirty ? 'primary' : 'ghost'} disabled={!dirty || saving} onClick={save}>
        {saving ? '…' : 'Save'}
      </Button>
    </div>
  );
}
