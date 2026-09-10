import { useCallback, useEffect, useRef, useState } from 'react';
import { createCategory, deleteCategory, listCategories, updateCategory, uploadCategoryImage, validateCategoryImageFile } from '../lib/adminApi';
import { useToast } from '../ToastContext';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, Icon, Modal, PageHeader, Spinner } from '../components/ui';
import s from '../admin.module.css';

const BLANK = { name: '', slug: '', description: '', image_url: '', sort_order: 0 };

export default function Categories() {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [imageMode, setImageMode] = useState('url');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileFinger, setSelectedFileFinger] = useState('');
  const [lastUploadedFinger, setLastUploadedFinger] = useState('');
  const [lastUploadedUrl, setLastUploadedUrl] = useState('');

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCategories();
      setCategories(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (editRow === 'new') {
      setForm({ ...BLANK });
      setImageMode('upload');
      setPreviewUrl('');
      setSelectedFile(null);
      setSelectedFileFinger('');
      setLastUploadedUrl('');
      setLastUploadedFinger('');
    } else if (editRow) {
      setForm({ ...BLANK, ...editRow, image_url: editRow.image_url || '' });
      setImageMode(editRow.image_url ? 'url' : 'upload');
      setPreviewUrl(editRow.image_url || '');
      setSelectedFile(null);
      setSelectedFileFinger('');
      setLastUploadedUrl(editRow.image_url || '');
      setLastUploadedFinger('');
    }
  }, [editRow]);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onFilePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      validateCategoryImageFile(file);
    } catch (e) {
      toast.error(e.message);
      event.target.value = '';
      return;
    }

    const finger = `${file.name}|${file.type}|${file.size}|${file.lastModified}`;
    setSelectedFile(file);
    setSelectedFileFinger(finger);
    setImageMode('upload');

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setForm((f) => ({ ...f, image_url: '' }));
    event.target.value = '';
  };

  const removeImage = () => {
    setSelectedFile(null);
    setSelectedFileFinger('');
    setImageMode('url');
    setPreviewUrl('');
    setLastUploadedUrl('');
    setLastUploadedFinger('');
    setForm((f) => ({ ...f, image_url: '' }));
  };

  const save = async () => {
    if (saving) return;
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(form.slug.trim())) { toast.error('Slug may contain only letters, numbers, and hyphens'); return; }
    if (!Number.isInteger(Number(form.sort_order)) || Number(form.sort_order) < 0) { toast.error('Sort order must be a whole number'); return; }
    if (form.image_url && !/^https?:\/\//i.test(form.image_url.trim())) { toast.error('Image URL must start with https://'); return; }

    setSaving(true);
    try {
      let nextImageUrl = (form.image_url || '').trim();
      if (selectedFile) {
        if (selectedFileFinger !== lastUploadedFinger) {
          nextImageUrl = await uploadCategoryImage(selectedFile);
          setLastUploadedFinger(selectedFileFinger);
          setLastUploadedUrl(nextImageUrl);
        } else {
          nextImageUrl = lastUploadedUrl || form.image_url || '';
        }
      }

      const normalized = {
        ...form,
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description?.trim() || null,
        image_url: nextImageUrl || null,
        sort_order: Number(form.sort_order) || 0,
      };

      let row;
      if (editRow === 'new') {
        row = await createCategory(normalized);
        toast.success('Category created');
        setCategories((items) => [{ ...row, product_count: 0 }, ...items]);
      } else {
        row = await updateCategory(editRow.id, normalized);
        toast.success('Category saved');
        setCategories((items) => items.map((item) => item.id === editRow.id ? ({ ...item, ...row, product_count: item.product_count || 0 }) : item));
      }

      setEditRow(null);
      setForm(BLANK);
      setPreviewUrl('');
      setSelectedFile(null);
      setSelectedFileFinger('');
      setLastUploadedFinger('');
      setLastUploadedUrl('');
    } catch (e) {
      toast.error(e.message || 'Unable to save category');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDel) return;
    try {
      await deleteCategory(confirmDel.id);
      toast.success('Category deleted');
      setCategories((items) => items.filter((item) => item.id !== confirmDel.id));
      setConfirmDel(null);
      setEditRow(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <PageHeader title="Categories" subtitle="Fragrance families used across Shop filters and the Collections page.">
        <Button variant="primary" icon="plus" onClick={() => setEditRow('new')}>Add category</Button>
      </PageHeader>

      {loading ? <Spinner />
        : error ? <ErrorState error={error} onRetry={loadCategories} />
        : categories.length === 0 ? <EmptyState title="No categories yet" action={<Button variant="primary" icon="plus" onClick={() => setEditRow('new')}>Add category</Button>} />
        : (
          <div className={s.tableWrap}>
            <div className={s.tableScroll}>
              <table className={s.table}>
                <thead><tr><th style={{ width: 60 }} /><th>Name</th><th>Slug</th><th>Description</th><th className={s.num}>Products</th><th className={s.num}>Order</th><th style={{ width: 90 }} /></tr></thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td>{c.image_url ? <img className={s.thumbSm} src={c.image_url} alt="" /> : <div className={s.thumbSm} />}</td>
                      <td className={s.cellMain}>{c.name}</td>
                      <td className={s.cellSub}>{c.slug}</td>
                      <td className={s.cellSub} style={{ maxWidth: 320 }}>{c.description || '—'}</td>
                      <td className={s.num}>{c.product_count || 0}</td>
                      <td className={s.num}>{c.sort_order || 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                          <Button size="sm" variant="ghost" onClick={() => setEditRow(c)}><Icon name="edit" size={13} /></Button>
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

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onFilePick} />

      <Modal open={!!editRow} title={editRow === 'new' ? 'New category' : `Edit ${editRow?.name || ''}`} onClose={() => setEditRow(null)}>
        <div className={s.form}>
          <Field label="Name"><input className={s.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Floral" /></Field>
          <Field label="Slug" hint="Leave blank to auto-generate from the name">
            <input className={s.input} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          </Field>
          <Field label="Description"><textarea className={s.textarea} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>

          <div className={s.formGrid}>
            <div className={s.field}>
              <span className={s.fieldLabel}>Category image</span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                <Button variant={imageMode === 'upload' ? 'primary' : 'ghost'} size="sm" icon="upload" onClick={openFilePicker}>Upload Image</Button>
                <Button variant={imageMode === 'url' ? 'primary' : 'ghost'} size="sm" icon="external" onClick={() => { setImageMode('url'); setSelectedFile(null); setSelectedFileFinger(''); }}>Image URL</Button>
              </div>

              {imageMode === 'upload' && (
                <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.8rem' }}>
                  <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input className={s.input} value={selectedFile ? selectedFile.name : 'No file selected'} readOnly />
                    <Button variant="ghost" size="sm" onClick={openFilePicker}>Choose file</Button>
                  </div>
                </div>
              )}

              {imageMode === 'url' && (
                <div style={{ marginTop: '0.8rem' }}>
                  <Field label="Image URL">
                    <input className={s.input} value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://example.com/category.jpg" />
                  </Field>
                </div>
              )}

              {(previewUrl || form.image_url) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
                  <div style={{ width: 96, height: 96, borderRadius: 4, border: '1px solid var(--admin-line)', background: '#fff', overflow: 'hidden' }}>
                    <img src={previewUrl || form.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <Button variant="ghost" size="sm" onClick={removeImage}>Remove image</Button>
                </div>
              )}
            </div>

            <Field label="Sort order"><input className={s.input} type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} /></Field>
          </div>

          <div className={s.dialogActions}>
            <Button variant="ghost" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button variant="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save category'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDel} title={`Delete ${confirmDel?.name}?`}
        message={confirmDel?.product_count ? `${confirmDel.product_count} product(s) use this category — they will keep working but show no family.` : 'This category has no products.'}
        confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setConfirmDel(null)} />
    </>
  );
}
