import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Store, Plus, Pencil, ImagePlus } from 'lucide-react';
import { Empty, Loading, loc, inr, timeAgo, Modal, Field } from '../ui';

// Values MUST match the DB check constraint shop_products_category_check (lowercase).
const CATEGORIES = [
  { value: 'feed',            label: 'Feed' },
  { value: 'feed_supplement', label: 'Feed supplement' },
  { value: 'medicine',        label: 'Medicine' },
  { value: 'accessories',     label: 'Accessories' },
  { value: 'cages',           label: 'Cages' },
];
const empty = { id: '', name: '', brand: '', category: 'feed', price: '', unit: '', stock_count: '', description: '', image_url: '', state: '', district: '', mandal: '', status: 'active' };

export default function Shop() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    // Robust: fetch products first (never blank the list on a failed join),
    // then look seller names up separately.
    const { data, error } = await supabase.from('shop_products')
      .select('*').order('created_at', { ascending: false }).limit(300);
    if (error) { alert('Could not load products: ' + error.message); setLoading(false); return; }
    const products = data || [];
    const ids = Array.from(new Set(products.map((p: any) => p.user_id).filter(Boolean)));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: us } = await supabase.from('users').select('id, full_name, handle').in('id', ids);
      (us || []).forEach((u: any) => { names[u.id] = u.full_name || (u.handle ? '@' + u.handle : '—'); });
    }
    setRows(products.map((p: any) => ({ ...p, _seller: names[p.user_id] || '—' })));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(r: any) {
    // 'suspended' isn't in the status check constraint — 'out_of_stock' is the legal "off" state.
    const next = r.status === 'active' ? 'out_of_stock' : 'active';
    const { error } = await supabase.from('shop_products').update({ status: next }).eq('id', r.id);
    if (error) { alert('Could not update product: ' + error.message); return; }
    setRows(x => x.map(p => p.id === r.id ? { ...p, status: next } : p));
  }
  // Item 16 — soft delete: restorable for 30 days, then the purge cron hard-deletes it.
  async function remove(r: any) {
    if (r.status === 'removed') {
      const { error } = await supabase.from('shop_products').update({ status: 'active', removed_at: null }).eq('id', r.id);
      if (error) { alert('Could not restore: ' + error.message); return; }
      setRows(x => x.map(p => p.id === r.id ? { ...p, status: 'active', removed_at: null } : p));
      return;
    }
    if (!confirm('Remove this product? It disappears from the app and can be restored for 30 days.')) return;
    const removed_at = new Date().toISOString();
    const { error } = await supabase.from('shop_products').update({ status: 'removed', removed_at }).eq('id', r.id);
    if (error) { alert('Could not remove: ' + error.message); return; }
    setRows(x => x.map(p => p.id === r.id ? { ...p, status: 'removed', removed_at } : p));
  }

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !edit) return;
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `admin/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const up = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: true });
      if (up.error) { alert('Image upload failed: ' + up.error.message); return; }
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      setEdit({ ...edit, image_url: data.publicUrl });
    } finally { setUploading(false); }
  }

  async function save() {
    if (!edit?.name?.trim()) { alert('Name is required.'); return; }
    setSaving(true);
    // category/price/stock_count/state/district/mandal/status are NOT NULL in the DB
    // (defaults ''/0/'active'). Never send null for them or the row fails to save.
    const payload: any = {
      name: edit.name.trim(), brand: edit.brand?.trim() || null, category: edit.category || 'feed',
      price: edit.price === '' ? 0 : Number(edit.price),
      unit: edit.unit?.trim() || null,
      stock_count: edit.stock_count === '' ? 0 : Number(edit.stock_count),
      description: edit.description?.trim() || null, image_url: edit.image_url || null,
      state: edit.state?.trim() || '', district: edit.district?.trim() || '', mandal: edit.mandal?.trim() || '',
      status: edit.status || 'active',
    };
    let error;
    if (edit.id) {
      ({ error } = await supabase.from('shop_products').update(payload).eq('id', edit.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.user_id = user?.id;   // store admin as the owner for house/official products
      ({ error } = await supabase.from('shop_products').insert(payload));
    }
    setSaving(false);
    if (error) { alert('Could not save: ' + error.message); return; }
    setEdit(null); load();
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="h1">Shop</h1>
          <p className="sub">Add, edit, moderate storefront products — with photos.</p>
        </div>
        <button className="btn" onClick={() => setEdit({ ...empty })}><Plus size={15} style={{ verticalAlign: -3 }} /> Add product</button>
      </div>

      <div className="card">
        <div className="card-h"><h2><Store size={16} /> Products ({rows.length})</h2></div>
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No shop products yet. Click “Add product”." /> : (
          <table>
            <thead><tr><th></th><th>Product</th><th>Seller</th><th>Category</th><th>Price</th><th>Stock</th><th>Location</th><th>Status</th><th>Added</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={r.status !== 'active' ? { opacity: .55 } : undefined}>
                  <td>{r.image_url ? <img className="thumb" src={r.image_url} /> : <div className="thumb" />}</td>
                  <td><b>{r.name}</b>{r.brand && <div className="muted">{r.brand}</div>}</td>
                  <td className="muted">{r._seller}</td>
                  <td><span className="badge b-mut">{r.category || '—'}</span></td>
                  <td>{inr(r.price)}{r.unit ? <span className="muted">/{r.unit}</span> : ''}</td>
                  <td className="muted">{r.stock_count ?? '—'}</td>
                  <td className="muted">{loc(r)}</td>
                  <td><span className={'badge ' + (r.status === 'active' ? 'b-ok' : 'b-mut')}>{r.status || 'active'}</span></td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><div className="row-acts">
                    <button className="btn ghost sm" onClick={() => setEdit({ ...empty, ...r, price: r.price ?? '', brand: r.brand ?? '', unit: r.unit ?? '', stock_count: r.stock_count ?? '', description: r.description ?? '' })}><Pencil size={12} /> Edit</button>
                    {r.status !== 'removed' && <button className="btn ghost sm" onClick={() => toggle(r)}>{r.status === 'active' ? 'Suspend' : 'Activate'}</button>}
                    <button className={r.status === 'removed' ? 'btn ok sm' : 'btn danger sm'} onClick={() => remove(r)}>{r.status === 'removed' ? 'Restore' : 'Remove'}</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Edit product' : 'Add product'} onClose={() => setEdit(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button>
          </>}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {edit.image_url ? <img src={edit.image_url} className="thumb" style={{ width: 72, height: 72 }} />
              : <div className="thumb" style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImagePlus size={22} /></div>}
            <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
              {uploading ? 'Uploading…' : 'Upload photo'}
              <input type="file" accept="image/*" hidden onChange={pickImage} onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} />
            </label>
          </div>
          <Field label="Name"><input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Growth booster feed" /></Field>
          <div className="grid2">
            <Field label="Brand"><input value={edit.brand} onChange={e => setEdit({ ...edit, brand: e.target.value })} /></Field>
            <Field label="Category">
              <select value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid2">
            <Field label="Price (₹)"><input type="number" value={edit.price} onChange={e => setEdit({ ...edit, price: e.target.value })} /></Field>
            <Field label="Unit (e.g. kg, pack)"><input value={edit.unit} onChange={e => setEdit({ ...edit, unit: e.target.value })} /></Field>
          </div>
          <div className="grid2">
            <Field label="Stock count"><input type="number" value={edit.stock_count} onChange={e => setEdit({ ...edit, stock_count: e.target.value })} /></Field>
            <Field label="Status">
              <select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                <option value="active">active</option><option value="out_of_stock">out_of_stock</option>
              </select>
            </Field>
          </div>
          <Field label="Description"><textarea rows={3} value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })} /></Field>
          <div className="grid2">
            <Field label="State"><input value={edit.state} onChange={e => setEdit({ ...edit, state: e.target.value })} /></Field>
            <Field label="District"><input value={edit.district} onChange={e => setEdit({ ...edit, district: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
