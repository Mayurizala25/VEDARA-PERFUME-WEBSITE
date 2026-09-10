import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addImageByUrl, createProduct, deleteProductImage, getProduct, getProductBySlug,
  listCategories, reorderImages, setPrimaryImage, slugify, syncProductVariants, updateProduct, uploadProductImage,
} from '../lib/adminApi';
import { useAsync, useUnsavedWarning } from '../hooks';
import { useToast } from '../ToastContext';
import { Button, ConfirmDialog, ErrorState, Field, Icon, PageHeader, Spinner, Toggle } from '../components/ui';
import s from '../admin.module.css';

const SIZE_OPTIONS = ['30ml', '50ml', '100ml'];
const BLANK = {
  name: '', slug: '', short_description: '', description: '', price: '', original_price: '',
  category_id: '', gender: 'Unisex', fragrance_type: 'Eau de Parfum', family: '',
  top_notes: '', heart_notes: '', base_notes: '', sizes: ['50ml'], stock: 0, sku: '', tone: 'beige',
  featured: false, best_seller: false, new_arrival: false, status: 'draft',
};

export default function ProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const toast = useToast();

  const meta = useAsync(() => Promise.all([
    listCategories(),
    editing ? getProduct(id) : Promise.resolve(null),
  ]).then(([categories, product]) => ({ categories, product })), [id]);

  const [form, setForm] = useState(BLANK);
  const [images, setImages] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirmDelImg, setConfirmDelImg] = useState(null);
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  useUnsavedWarning(dirty && !saving);

  useEffect(() => {
    if (!meta.data) return;
    if (meta.data.product) {
      const p = meta.data.product;
      setForm({
        name: p.name || '', slug: p.slug || '', short_description: p.short_description || '',
        description: p.description || '', price: p.price ?? '', original_price: p.original_price ?? '',
        category_id: p.category_id || '', gender: p.gender || 'Unisex',
        fragrance_type: p.fragrance_type || 'Eau de Parfum', family: p.family || '',
        top_notes: p.top_notes || '', heart_notes: p.heart_notes || '', base_notes: p.base_notes || '',
        sizes: Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['50ml'],
        stock: p.stock ?? 0, sku: p.sku || '', tone: p.tone || 'beige',
        featured: !!p.featured, best_seller: !!p.best_seller, new_arrival: !!p.new_arrival,
        status: p.status || 'draft',
      });
      setImages(p.images || []);
      setSlugTouched(true);
    }
  }, [meta.data]);

  const upd = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };

  const autoSlug = useMemo(
    () => (slugTouched ? form.slug : slugify(form.name)),
    [form.name, form.slug, slugTouched],
  );

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!autoSlug) e.slug = 'Required';
    if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) e.price = 'Enter a valid price ≥ 0';
    if (form.original_price !== '' && (!Number.isFinite(Number(form.original_price)) || Number(form.original_price) <= Number(form.price))) {
      e.original_price = 'Should be higher than the price (or leave blank)';
    }
    if (!Number.isInteger(Number(form.stock)) || Number(form.stock) < 0) e.stock = 'Stock must be a whole number ≥ 0';
    if (form.sku && !/^[A-Z0-9_-]+$/i.test(form.sku.trim())) e.sku = 'Use letters, numbers, hyphens, or underscores';
    if (!form.sizes.length) e.sizes = 'Pick at least one size';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async ({ thenNew = false } = {}) => {
    if (!validate()) { toast.error('Fix the highlighted fields'); return; }
    setSaving(true);
    const payload = { ...form, slug: autoSlug };
    try {
      // slug uniqueness (friendly message rather than a raw 23505)
      const clash = await getProductBySlug(autoSlug);
      if (clash && clash.id !== id) { setErrors({ slug: 'Another product already uses this URL slug' }); setSaving(false); toast.error('Slug already in use'); return; }

      if (editing) {
        await updateProduct(id, payload);
        await syncProductVariants(id, payload.sizes, payload.stock, payload.price);
        toast.success('Product saved — live on the store now');
        setDirty(false);
        meta.reload();
      } else {
        const created = await createProduct(payload);
        await syncProductVariants(created.id, payload.sizes, payload.stock, payload.price);
        if (pendingFiles.length) {
          setUploading(true);
          try {
            for (const file of pendingFiles) await uploadProductImage(created.id, file.file);
          } finally { setUploading(false); }
        }
        toast.success('Product created');
        setDirty(false);
        if (thenNew) {
          setForm(BLANK);
          setImages([]);
          setPendingFiles([]);
          setSlugTouched(false);
        }
        nav(thenNew ? '/products/new' : `/products/${created.id}/edit`, { replace: !thenNew });
      }
    } catch (err) {
      toast.error(err.message || 'Could not save');
    } finally { setSaving(false); }
  };

  const handleFiles = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    const invalid = list.find((file) => file.size > 5 * 1024 * 1024);
    if (invalid) { toast.error(`${invalid.name} is over 5 MB`); return; }
    if (!editing) {
      setPendingFiles((prev) => [...prev, ...list.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
      setDirty(true);
      toast.success(`${list.length} image${list.length === 1 ? '' : 's'} ready to upload when saved`);
      return;
    }
    setUploading(true);
    try {
      for (const file of list) {
        const img = await uploadProductImage(id, file);
        setImages((prev) => [...prev, img]);
      }
      toast.success('Image(s) uploaded');
    } catch (e) { toast.error(e.message); } finally { setUploading(false); }
  };

  const removeImage = async () => {
    try {
      await deleteProductImage(confirmDelImg);
      setImages((prev) => prev.filter((i) => i.id !== confirmDelImg.id));
      setConfirmDelImg(null);
      toast.success('Image removed');
    } catch (e) { toast.error(e.message); }
  };

  const makePrimary = async (img) => {
    try {
      await setPrimaryImage(id, img.id);
      setImages((prev) => prev.map((i) => ({ ...i, is_primary: i.id === img.id })));
      toast.success('Primary image set');
    } catch (e) { toast.error(e.message); }
  };

  const move = async (idx, dir) => {
    const next = [...images];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setImages(next);
    try { await reorderImages(next); } catch (e) { toast.error(e.message); }
  };

  if (meta.loading) return <Spinner label="Loading…" />;
  if (meta.error) return <ErrorState error={meta.error} onRetry={meta.reload} />;

  const categories = meta.data.categories || [];

  return (
    <>
      <PageHeader title={editing ? form.name || 'Edit product' : 'New product'}
        subtitle={editing ? 'Changes go live on the customer store as soon as you save.' : 'Fill in the details, then add photos once saved.'}>
        <Button variant="ghost" onClick={() => nav('/products')}>← All products</Button>
        {editing ? <Button variant="ghost" icon="external" onClick={() => window.open(`/product/${form.slug}`, '_blank')}>View on store</Button> : null}
      </PageHeader>

      <form className={s.formLayout} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className={s.form}>
          <div className={s.card}>
            <div className={s.cardPad}>
              <div className={s.cardTitle}>Basics</div>
              <div className={s.form}>
                <Field label="Product name" error={errors.name}>
                  <input className={s.input} value={form.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Oudh Noir" />
                </Field>
                <div className={s.formGrid}>
                  <Field label="URL slug" hint={`/product/${autoSlug || '…'}`} error={errors.slug}>
                    <input className={s.input} value={autoSlug}
                      onChange={(e) => { setSlugTouched(true); upd({ slug: e.target.value }); }} />
                  </Field>
                  <Field label="SKU" error={errors.sku}>
                    <input className={s.input} value={form.sku} onChange={(e) => upd({ sku: e.target.value })} placeholder="VD-OUDH-NOIR" />
                  </Field>
                </div>
                <Field label="Short description" hint="One line, shown on cards and quick view">
                  <input className={s.input} value={form.short_description} onChange={(e) => upd({ short_description: e.target.value })} />
                </Field>
                <Field label="Full description">
                  <textarea className={s.textarea} rows={4} value={form.description} onChange={(e) => upd({ description: e.target.value })} />
                </Field>
              </div>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardPad}>
              <div className={s.cardTitle}>Pricing &amp; stock</div>
              <div className={s.formGrid3}>
                <Field label="Price (₹)" error={errors.price}>
                  <input className={s.input} type="number" min="0" step="1" value={form.price} onChange={(e) => upd({ price: e.target.value })} />
                </Field>
                <Field label="Original price (₹)" hint="For a strike-through; blank = no offer" error={errors.original_price}>
                  <input className={s.input} type="number" min="0" step="1" value={form.original_price} onChange={(e) => upd({ original_price: e.target.value })} />
                </Field>
                <Field label="Stock on hand" error={errors.stock}>
                  <input className={s.input} type="number" min="0" step="1" value={form.stock} onChange={(e) => upd({ stock: e.target.value })} />
                </Field>
              </div>
              <Field label="Sizes offered" error={errors.sizes}>
                <div className={s.checkRow}>
                  {SIZE_OPTIONS.map((sz) => (
                    <label key={sz} className={s.toggle}>
                      <input type="checkbox" checked={form.sizes.includes(sz)}
                        onChange={(e) => upd({ sizes: e.target.checked ? [...form.sizes, sz] : form.sizes.filter((x) => x !== sz) })} />
                      <span>{sz}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardPad}>
              <div className={s.cardTitle}>Classification</div>
              <div className={s.formGrid}>
                <Field label="Shopping category (gender)">
                  <select className={s.select} value={form.gender} onChange={(e) => upd({ gender: e.target.value })}>
                    <option>Men</option><option>Women</option><option>Unisex</option>
                  </select>
                </Field>
                <Field label="Fragrance family">
                  <select className={s.select} value={form.category_id} onChange={(e) => upd({ category_id: e.target.value })}>
                    <option value="">— none —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Concentration / type">
                  <select className={s.select} value={form.fragrance_type} onChange={(e) => upd({ fragrance_type: e.target.value })}>
                    <option>Eau de Parfum</option><option>Parfum</option><option>Eau de Toilette</option>
                  </select>
                </Field>
                <Field label="Family label" hint="Shown on the card, e.g. “Oud · Woody”">
                  <input className={s.input} value={form.family} onChange={(e) => upd({ family: e.target.value })} />
                </Field>
              </div>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardPad}>
              <div className={s.cardTitle}>Scent pyramid</div>
              <div className={s.formGrid3}>
                <Field label="Top notes"><input className={s.input} value={form.top_notes} onChange={(e) => upd({ top_notes: e.target.value })} placeholder="Saffron, Bergamot" /></Field>
                <Field label="Heart notes"><input className={s.input} value={form.heart_notes} onChange={(e) => upd({ heart_notes: e.target.value })} placeholder="Rose, Oud" /></Field>
                <Field label="Base notes"><input className={s.input} value={form.base_notes} onChange={(e) => upd({ base_notes: e.target.value })} placeholder="Amber, Sandalwood" /></Field>
              </div>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardPad}>
              <div className={s.cardTitle}>Photos</div>
              <>
                  {!editing && pendingFiles.length ? <div className={s.imageGrid} style={{ marginBottom: '0.9rem' }}>
                    {pendingFiles.map((file, index) => <div key={`${file.file.name}-${index}`} className={s.imageItem}>
                      <img src={file.preview} alt={file.file.name} />
                      <div className={s.imageActions}><button type="button" onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}>Remove</button></div>
                    </div>)}
                  </div> : null}
                  {images.length ? (
                    <div className={s.imageGrid} style={{ marginBottom: '0.9rem' }}>
                      {images.map((img, i) => (
                        <div key={img.id} className={s.imageItem} data-primary={img.is_primary || undefined}>
                          <img src={img.url} alt={img.alt || ''} />
                          <div className={s.imageActions}>
                            {!img.is_primary ? <button type="button" onClick={() => makePrimary(img)}>Primary</button> : null}
                            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>←</button>
                            <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1}>→</button>
                            <button type="button" onClick={() => setConfirmDelImg(img)}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className={s.dropzone} data-over={dragOver || undefined}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}>
                    <Icon name="upload" size={22} />
                    <div style={{ marginTop: '0.4rem' }}>{uploading ? 'Uploading…' : 'Click or drop images (JPG/PNG/WebP, ≤ 5 MB)'}</div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
                  {editing ? <UrlAdder onAdd={async (url) => {
                    try { const img = await addImageByUrl(id, url); setImages((p) => [...p, img]); toast.success('Image added'); }
                    catch (e) { toast.error(e.message); }
                  }} /> : <p className={s.cellSub} style={{ marginTop: '0.65rem' }}>Images will upload automatically when you create the product.</p>}
              </>
            </div>
          </div>
        </div>

        <aside className={s.formAside}>
          <div className={s.card}>
            <div className={s.cardPad}>
              <div className={s.cardTitle}>Visibility</div>
              <Field label="Status">
                <select className={s.select} value={form.status} onChange={(e) => upd({ status: e.target.value })}>
                  <option value="active">Active — visible &amp; buyable</option>
                  <option value="draft">Draft — hidden from customers</option>
                  <option value="archived">Archived — hidden, kept for records</option>
                </select>
              </Field>
              <div style={{ display: 'grid', gap: '0.7rem', marginTop: '0.9rem' }}>
                <Toggle checked={form.featured} onChange={(v) => upd({ featured: v })} label="Featured on homepage" />
                <Toggle checked={form.best_seller} onChange={(v) => upd({ best_seller: v })} label="Best seller" />
                <Toggle checked={form.new_arrival} onChange={(v) => upd({ new_arrival: v })} label="New arrival" />
              </div>
            </div>
          </div>
          <div className={s.card}>
            <div className={s.cardPad}>
              <div className={s.cardTitle}>Placeholder tint</div>
              <Field hint="Colour shown while an image loads">
                <select className={s.select} value={form.tone} onChange={(e) => upd({ tone: e.target.value })}>
                  <option>beige</option><option>ivory</option><option>charcoal</option><option>cherry</option>
                </select>
              </Field>
            </div>
          </div>
        </aside>

        <div className={s.stickyBar}>
          {dirty ? <><span className={s.dirtyDot} /><span className={s.cellSub}>Unsaved changes</span></> : <span className={s.cellSub}>All changes saved</span>}
          <span className={s.spacer} />
          <Button type="button" variant="ghost" onClick={() => nav('/products')}>Cancel</Button>
          {!editing ? <Button type="button" variant="ghost" disabled={saving} onClick={() => save({ thenNew: true })}>Save &amp; new</Button> : null}
          <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save product' : 'Create product'}</Button>
        </div>
      </form>

      <ConfirmDialog open={!!confirmDelImg} title="Remove this image?" message="It’s deleted from storage and the product straight away."
        confirmLabel="Remove" danger onConfirm={removeImage} onCancel={() => setConfirmDelImg(null)} />
    </>
  );
}

function UrlAdder({ onAdd }) {
  const [url, setUrl] = useState('');
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
      <input className={s.input} placeholder="…or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      <Button type="button" variant="ghost" disabled={!url.trim()} onClick={() => { onAdd(url.trim()); setUrl(''); }}>Add</Button>
    </div>
  );
}
