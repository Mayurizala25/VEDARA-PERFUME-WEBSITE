import { useEffect, useState } from 'react';
import { createCoupon, deleteCoupon, listCoupons, updateCoupon } from '../lib/adminApi';
import { useAsync } from '../hooks';
import { useToast } from '../ToastContext';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Icon, Modal, Money, PageHeader, Spinner, Toggle } from '../components/ui';
import { formatDate } from '../../lib/format';
import s from '../admin.module.css';

const BLANK = { code: '', description: '', discount_type: 'percent', discount_value: 10, min_subtotal: 0, active: true, starts_at: '', expires_at: '', usage_limit: '' };
const dt = (v) => (v ? String(v).slice(0, 10) : '');

export default function Coupons() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(listCoupons);
  const [edit, setEdit] = useState(null); // row | 'new' | null
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    if (edit === 'new') setForm(BLANK);
    else if (edit) setForm({ ...BLANK, ...edit, starts_at: dt(edit.starts_at), expires_at: dt(edit.expires_at), usage_limit: edit.usage_limit ?? '' });
  }, [edit]);

  const save = async () => {
    if (!/^[A-Z0-9_-]{3,40}$/i.test(form.code.trim())) { toast.error('Use 3–40 letters, numbers, hyphens, or underscores for the code'); return; }
    if (!(Number(form.discount_value) > 0) || (form.discount_type === 'percent' && Number(form.discount_value) > 100)) { toast.error(form.discount_type === 'percent' ? 'Percentage must be between 1 and 100' : 'Discount value must be greater than 0'); return; }
    if (!(Number(form.min_subtotal) >= 0)) { toast.error('Minimum order cannot be negative'); return; }
    if (form.usage_limit !== '' && (!Number.isInteger(Number(form.usage_limit)) || Number(form.usage_limit) < 1)) { toast.error('Usage limit must be a whole number'); return; }
    if (form.starts_at && form.expires_at && form.expires_at < form.starts_at) { toast.error('Expiry date must be on or after the start date'); return; }
    setSaving(true);
    try {
      if (edit === 'new') { await createCoupon(form); toast.success(`${form.code.toUpperCase()} created`); }
      else { await updateCoupon(edit.id, form); toast.success('Coupon saved'); }
      setEdit(null);
      reload();
    } catch (e) {
      toast.error(/duplicate|unique/i.test(e.message) ? 'That code already exists' : e.message);
    } finally { setSaving(false); }
  };

  const toggleActive = async (c) => {
    try { await updateCoupon(c.id, { ...c, active: !c.active, starts_at: dt(c.starts_at), expires_at: dt(c.expires_at), usage_limit: c.usage_limit ?? '' }); reload(); toast.success(`${c.code} ${!c.active ? 'activated' : 'deactivated'}`); }
    catch (e) { toast.error(e.message); }
  };

  const remove = async () => {
    try { await deleteCoupon(confirmDel.id); toast.success('Coupon deleted'); setConfirmDel(null); reload(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Coupons" subtitle="Codes customers enter in the cart. Checkout re-validates every one server-side.">
        <Button variant="primary" icon="plus" onClick={() => setEdit('new')}>New coupon</Button>
      </PageHeader>

      {loading ? <Spinner />
        : error ? <ErrorState error={error} onRetry={reload} />
        : data.length === 0 ? <EmptyState title="No coupons yet" action={<Button variant="primary" icon="plus" onClick={() => setEdit('new')}>New coupon</Button>} />
        : (
          <div className={s.tableWrap}>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead><tr><th>Code</th><th>Discount</th><th className={s.num}>Min order</th><th className={s.num}>Used</th><th>Expires</th><th>Active</th><th style={{ width: 110 }} /></tr></thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td><span className={s.cellMain}>{c.code}</span><div className={s.cellSub}>{c.description || '—'}</div></td>
                      <td>{c.discount_type === 'percent' ? `${c.discount_value}%` : <Money value={c.discount_value} />}</td>
                      <td className={s.num}>{c.min_subtotal ? <Money value={c.min_subtotal} /> : '—'}</td>
                      <td className={s.num}>{c.times_used}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
                      <td className={s.cellSub}>{c.expires_at ? formatDate(c.expires_at) : 'Never'}</td>
                      <td><Toggle checked={c.active} onChange={() => toggleActive(c)} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                          <Button size="sm" variant="ghost" onClick={() => setEdit(c)}><Icon name="edit" size={13} /></Button>
                          <Button size="sm" variant="danger" onClick={() => setConfirmDel(c)}><Icon name="trash" size={13} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <Modal open={!!edit} title={edit === 'new' ? 'New coupon' : `Edit ${edit?.code || ''}`} onClose={() => setEdit(null)}>
        <div className={s.form}>
          <Field label="Code"><input className={s.input} value={form.code} style={{ textTransform: 'uppercase' }} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="WELCOME10" /></Field>
          <Field label="Description"><input className={s.input} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <div className={s.formGrid}>
            <Field label="Type">
              <select className={s.select} value={form.discount_type} onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))}>
                <option value="percent">Percentage</option><option value="fixed">Fixed amount (₹)</option>
              </select>
            </Field>
            <Field label={form.discount_type === 'percent' ? 'Percent off' : 'Amount off (₹)'}>
              <input className={s.input} type="number" min="0" value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} />
            </Field>
          </div>
          <div className={s.formGrid}>
            <Field label="Minimum order (₹)"><input className={s.input} type="number" min="0" value={form.min_subtotal} onChange={(e) => setForm((f) => ({ ...f, min_subtotal: e.target.value }))} /></Field>
            <Field label="Usage limit" hint="Blank = unlimited"><input className={s.input} type="number" min="0" value={form.usage_limit} onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))} /></Field>
          </div>
          <div className={s.formGrid}>
            <Field label="Starts"><input className={s.input} type="date" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} /></Field>
            <Field label="Expires"><input className={s.input} type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} /></Field>
          </div>
          <Toggle checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Active" />
          <div className={s.dialogActions}>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button variant="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save coupon'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDel} title={`Delete ${confirmDel?.code}?`} message="Customers can no longer use this code." confirmLabel="Delete" danger
        onConfirm={remove} onCancel={() => setConfirmDel(null)} />
    </>
  );
}
