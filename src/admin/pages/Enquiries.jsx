import { useState } from 'react';
import { deleteEnquiry, listEnquiries, setEnquiryStatus } from '../lib/adminApi';
import { useAsync, useListParams } from '../hooks';
import { useToast } from '../ToastContext';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Pagination, SearchInput, Spinner } from '../components/ui';
import { formatDate } from '../../lib/format';
import s from '../admin.module.css';

const PAGE_SIZE = 20;
const STATES = ['new', 'contacted', 'resolved'];

export default function Enquiries() {
  const toast = useToast();
  const { params, raw, set } = useListParams({});
  const { data, loading, error, reload } = useAsync(
    () => listEnquiries({ ...params, pageSize: PAGE_SIZE }),
    [params.search, params.status, params.page],
  );
  const [view, setView] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const changeStatus = async (row, status) => {
    try { await setEnquiryStatus(row.id, status); toast.success(`Marked ${status}`); reload(); setView((v) => (v && v.id === row.id ? { ...v, status } : v)); }
    catch (e) { toast.error(e.message); }
  };
  const remove = async () => {
    try { await deleteEnquiry(confirmDel.id); toast.success('Enquiry deleted'); setConfirmDel(null); setView(null); reload(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Contact enquiries" subtitle="Messages from the site’s contact form." />

      <div className={s.toolbar}>
        <SearchInput value={raw.search} onChange={(v) => set({ search: v })} placeholder="Name, email or subject…" />
        <select className={s.select} style={{ maxWidth: 160 }} value={raw.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">All</option>
          {STATES.map((st) => <option key={st} value={st}>{st[0].toUpperCase() + st.slice(1)}</option>)}
        </select>
      </div>

      {loading ? <Spinner label="Loading enquiries…" />
        : error ? <ErrorState error={error} onRetry={reload} />
        : data.rows.length === 0 ? <EmptyState title="No enquiries" text="Contact form submissions land here." />
        : (
          <div className={s.tableWrap}>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead><tr><th>From</th><th>Subject</th><th>Received</th><th>Status</th><th style={{ width: 90 }} /></tr></thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td><div className={s.cellMain}>{r.name}</div><div className={s.cellSub}>{r.email}{r.phone ? ` · ${r.phone}` : ''}</div></td>
                      <td>{r.subject || r.topic || '—'}<div className={s.cellSub} style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.message}</div></td>
                      <td className={s.cellSub}>{formatDate(r.created_at)}</td>
                      <td><Badge>{r.status}</Badge></td>
                      <td><Button size="sm" variant="ghost" onClick={() => setView(r)}>Open</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={params.page} pageSize={PAGE_SIZE} total={data.count} onPage={(p) => set({ page: p })} />
          </div>
        )}

      <Modal open={!!view} title={view?.subject || view?.topic || 'Enquiry'} onClose={() => setView(null)} wide>
        {view ? (
          <>
            <dl className={s.kv} style={{ marginBottom: '1rem' }}>
              <dt>Name</dt><dd>{view.name}</dd>
              <dt>Email</dt><dd><a href={`mailto:${view.email}`}>{view.email}</a></dd>
              <dt>Phone</dt><dd>{view.phone || '—'}</dd>
              <dt>Received</dt><dd>{formatDate(view.created_at)}</dd>
            </dl>
            <div className={s.fieldLabel}>Message</div>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.6, margin: '0.4rem 0 1rem' }}>{view.message}</p>
            <div className={s.fieldLabel}>Status</div>
            <div className={s.statusFlow} style={{ marginTop: '0.4rem' }}>
              {STATES.map((st) => (
                <button key={st} className={`${s.btn} ${s.btnGhost} ${s.btnSm}`} data-active={view.status === st || undefined}
                  style={view.status === st ? { background: 'var(--color-cherry)', color: '#fff', borderColor: 'var(--color-cherry)' } : undefined}
                  onClick={() => changeStatus(view, st)}>
                  {st[0].toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
            <div className={s.dialogActions}>
              <Button variant="danger" onClick={() => setConfirmDel(view)}>Delete</Button>
              <Button variant="ghost" onClick={() => setView(null)}>Close</Button>
            </div>
          </>
        ) : null}
      </Modal>

      <ConfirmDialog open={!!confirmDel} title="Delete this enquiry?" confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setConfirmDel(null)} />
    </>
  );
}
