import { useState } from 'react';
import { listAdmins, newsletterCount, setAdminByEmail } from '../lib/adminApi';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../hooks';
import { useToast } from '../ToastContext';
import { Badge, Button, ConfirmDialog, ErrorState, Field, PageHeader, Spinner } from '../components/ui';
import { formatDate } from '../../lib/format';
import s from '../admin.module.css';

export default function Settings() {
  const toast = useToast();
  const { user, profile, updateProfile } = useAuth();
  const admins = useAsync(() => Promise.all([listAdmins(), newsletterCount()]).then(([list, count]) => ({ list, count })));

  const [pName, setPName] = useState(profile?.full_name || '');
  const [pPhone, setPPhone] = useState(profile?.phone || '');
  const [savingP, setSavingP] = useState(false);
  const [newAdmin, setNewAdmin] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(null);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingP(true);
    try { await updateProfile({ full_name: pName, phone: pPhone }); toast.success('Your details are saved'); }
    catch (err) { toast.error(err.message); } finally { setSavingP(false); }
  };

  const addAdmin = async (e) => {
    e.preventDefault();
    if (!newAdmin.trim()) return;
    setAddingAdmin(true);
    try {
      await setAdminByEmail(newAdmin, true);
      toast.success(`${newAdmin} is now an admin`);
      setNewAdmin('');
      admins.reload();
    } catch (err) { toast.error(err.message); } finally { setAddingAdmin(false); }
  };

  const revoke = async () => {
    try {
      await setAdminByEmail(confirmRevoke.email, false);
      toast.success(`${confirmRevoke.email} is no longer an admin`);
      setConfirmRevoke(null);
      admins.reload();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account and who else can run the shop." />

      <div className={s.dashGrid}>
        <div className={s.card}>
          <div className={s.cardPad}>
            <div className={s.cardTitle}>Your details</div>
            <form className={s.form} onSubmit={saveProfile}>
              <Field label="Email"><input className={s.input} value={user?.email || ''} disabled /></Field>
              <Field label="Full name"><input className={s.input} value={pName} onChange={(e) => setPName(e.target.value)} /></Field>
              <Field label="Phone"><input className={s.input} value={pPhone} onChange={(e) => setPPhone(e.target.value)} /></Field>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <Button type="submit" variant="primary" disabled={savingP}>{savingP ? 'Saving…' : 'Save details'}</Button>
                <Button type="button" variant="ghost" onClick={() => { window.location.href = '/login?type=forgot'; }}>Change password</Button>
              </div>
            </form>
          </div>
        </div>

        <div className={s.card}>
          <div className={s.cardPad}>
            <div className={s.cardTitle}>Store</div>
            <dl className={s.kv}>
              <dt>Newsletter</dt><dd>{admins.loading ? '…' : `${admins.data?.count ?? 0} subscriber(s)`}</dd>
              <dt>Storefront</dt><dd><a href="/" target="_blank" rel="noreferrer">Open store ↗</a></dd>
              <dt>Database</dt><dd>Supabase — shared with the customer site</dd>
            </dl>
          </div>
        </div>
      </div>

      <div className={s.card} style={{ marginTop: '1.1rem' }}>
        <div className={s.cardPad}>
          <div className={s.cardTitle}>Admin team</div>
          <p className={s.fieldHint} style={{ marginBottom: '0.9rem' }}>
            An admin must first sign up as a normal customer. Then add their email here to grant panel access.
          </p>
          <form onSubmit={addAdmin} style={{ display: 'flex', gap: '0.6rem', maxWidth: 480, marginBottom: '1rem' }}>
            <input className={s.input} type="email" placeholder="teammate@example.com" value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)} />
            <Button type="submit" variant="primary" disabled={addingAdmin}>{addingAdmin ? 'Adding…' : 'Grant access'}</Button>
          </form>

          {admins.loading ? <Spinner />
            : admins.error ? <ErrorState error={admins.error} onRetry={admins.reload} />
            : (
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead><tr><th>Name</th><th>Email</th><th>Since</th><th style={{ width: 100 }} /></tr></thead>
                  <tbody>
                    {(admins.data.list || []).map((a) => (
                      <tr key={a.id}>
                        <td className={s.cellMain}>{a.full_name || '—'} {a.id === user?.id ? <Badge tone="cherry">You</Badge> : null}</td>
                        <td className={s.cellSub}>{a.email}</td>
                        <td className={s.cellSub}>{formatDate(a.created_at)}</td>
                        <td>{a.id !== user?.id ? <Button size="sm" variant="danger" onClick={() => setConfirmRevoke(a)}>Revoke</Button> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>

      <ConfirmDialog open={!!confirmRevoke} title={`Revoke admin for ${confirmRevoke?.email}?`}
        message="They keep their customer account but lose panel access immediately." confirmLabel="Revoke" danger
        onConfirm={revoke} onCancel={() => setConfirmRevoke(null)} />
    </>
  );
}
