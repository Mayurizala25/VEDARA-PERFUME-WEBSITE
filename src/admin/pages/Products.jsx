import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteProduct, listCategories, listProducts, setProductFlags } from '../lib/adminApi';
import { useAsync, useListParams } from '../hooks';
import { useToast } from '../ToastContext';
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, Icon, Money, PageHeader,
  Pagination, SearchInput, Spinner, Th, Toggle,
} from '../components/ui';
import s from '../admin.module.css';

const PAGE_SIZE = 20;

export default function Products() {
  const nav = useNavigate();
  const toast = useToast();
  const { params, raw, set } = useListParams({ sort: 'created_at.desc', category: '', filter: '' });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => listProducts({ ...params, pageSize: PAGE_SIZE }),
    [params.search, params.status, params.gender, params.category, params.filter, params.sort, params.page],
  );
  const categories = useAsync(listCategories);

  const toggleFlag = async (row, key) => {
    try {
      await setProductFlags(row.id, { [key]: !row[key] });
      toast.success(`${row.name} updated`);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await deleteProduct(confirm.id);
      toast.success(`${confirm.name} deleted`);
      setConfirm(null);
      reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Products" subtitle="Everything a customer can buy. Changes are live immediately.">
        <Button variant="primary" icon="plus" onClick={() => nav('/products/new')}>Add product</Button>
      </PageHeader>

      <div className={s.toolbar}>
        <SearchInput value={raw.search} onChange={(v) => set({ search: v })} placeholder="Search name or SKU…" />
        <select className={s.select} style={{ maxWidth: 150 }} value={raw.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select className={s.select} style={{ maxWidth: 140 }} value={raw.gender} onChange={(e) => set({ gender: e.target.value })}>
          <option value="">All genders</option>
          <option>Men</option><option>Women</option><option>Unisex</option>
        </select>
        <select className={s.select} style={{ maxWidth: 170 }} value={raw.category} onChange={(e) => set({ category: e.target.value })}>
          <option value="">All categories</option>
          {(categories.data || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select className={s.select} style={{ maxWidth: 150 }} value={raw.filter} onChange={(e) => set({ filter: e.target.value })}>
          <option value="">All stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
        </select>
        <select className={s.select} style={{ maxWidth: 170 }} value={raw.sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="created_at.desc">Newest</option><option value="name.asc">Name A–Z</option><option value="price.asc">Price low–high</option><option value="price.desc">Price high–low</option><option value="stock.asc">Stock low–high</option>
        </select>
      </div>

      {loading ? <Spinner label="Loading products…" />
        : error ? <ErrorState error={error} onRetry={reload} />
        : data.rows.length === 0 ? (
          <EmptyState title="No products match" text="Try a different search or clear the filters."
            action={<Button variant="primary" icon="plus" onClick={() => nav('/products/new')}>Add product</Button>} />
        ) : (
          <div className={s.tableWrap}>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th style={{ width: 52 }} />
                    <Th sortKey="name" sort={params.sort} onSort={(v) => set({ sort: v })}>Product</Th>
                    <th>SKU</th>
                    <Th sortKey="price" sort={params.sort} onSort={(v) => set({ sort: v })} className={s.num}>Price</Th>
                    <Th sortKey="stock" sort={params.sort} onSort={(v) => set({ sort: v })} className={s.num}>Stock</Th>
                    <th>Flags</th>
                    <th>Status</th>
                    <th style={{ width: 90 }} />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.primaryImage
                        ? <img className={s.thumb} src={row.primaryImage.url} alt="" />
                        : <div className={s.thumb} />}</td>
                      <td>
                        <Link to={`/products/${row.id}/edit`} className={s.cellMain}>{row.name}</Link>
                        <div className={s.cellSub}>{[row.gender, row.category?.name, row.fragrance_type].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className={s.cellSub}>{row.sku || '—'}</td>
                      <td className={s.num}>
                        <Money value={row.price} />
                        {row.original_price ? <div className={s.cellSub} style={{ textDecoration: 'line-through' }}><Money value={row.original_price} /></div> : null}
                      </td>
                      <td className={s.num}>
                        <Badge tone={row.stock === 0 ? 'red' : row.stock <= 5 ? 'amber' : 'green'}>{row.stock ?? 0}</Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button className={s.chip} data-on={row.featured || undefined} onClick={() => toggleFlag(row, 'featured')} title="Featured">
                            {row.featured ? '★' : '☆'} Feat
                          </button>
                          <button className={s.chip} onClick={() => toggleFlag(row, 'best_seller')} title="Best seller">
                            {row.best_seller ? '●' : '○'} Best
                          </button>
                          <button className={s.chip} onClick={() => toggleFlag(row, 'new_arrival')} title="New arrival">
                            {row.new_arrival ? '●' : '○'} New
                          </button>
                        </div>
                      </td>
                      <td><Badge>{row.status}</Badge></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                          <Button size="sm" variant="ghost" onClick={() => nav(`/products/${row.id}/edit`)}><Icon name="edit" size={13} /></Button>
                          <Button size="sm" variant="danger" onClick={() => setConfirm(row)}><Icon name="trash" size={13} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={params.page} pageSize={PAGE_SIZE} total={data.count} onPage={(p) => set({ page: p })} />
          </div>
        )}

      <ConfirmDialog
        open={!!confirm}
        title={`Delete ${confirm?.name}?`}
        message="This removes the product, its images and stock from the store immediately. Orders that already contain it keep their record. This cannot be undone."
        confirmLabel="Delete product" danger busy={busy}
        onConfirm={doDelete} onCancel={() => setConfirm(null)}
      />
    </>
  );
}
