import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Megaphone, Plus, Pencil, ImagePlus } from 'lucide-react';
import { Empty, Loading, inr, timeAgo, Modal, Field } from '../ui';
import { STATES } from '../locations';

// Your own product ads shown in the app (Oct 2026): Sponsored reels on Home, a card on
// the bird page and a Featured slot in the Shop. The app asks the server which ads to
// show (get_ads: live dates, targeting, per-person daily cap); this page manages them
// and shows views / taps / orders from admin_ad_stats().
const PLACES = [
  { value: 'reel', label: 'Home reels' },
  { value: 'listing', label: 'Bird page' },
  { value: 'shop', label: 'Shop (Featured)' },
  { value: 'home', label: 'Home banner' },
];
const TYPES = [
  { value: 'fighter', label: 'Game' }, { value: 'breeder', label: 'Breeder' }, { value: 'patta', label: 'Patta' },
  { value: 'layer', label: 'Layer' }, { value: 'show', label: 'Show' }, { value: 'chick', label: 'Chicks' }, { value: 'eggs', label: 'Eggs' },
];
const blank = {
  id: '', title: '', subtitle: '', sponsor: 'Rooster Club Nutrition', media_url: '', media_type: 'photo', poster_url: '',
  product_id: '', link: '', cta_label: '', price: '', placements: ['reel', 'listing', 'shop'], target_states: [] as string[],
  target_types: [] as string[], starts_at: '', ends_at: '', status: 'active', max_per_day: '2', priority: '0',
};
const dt = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

export default function Ads() {
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'' | 'media' | 'poster'>('');

  async function load() {
    setLoading(true);
    const [{ data, error }, { data: st }, { data: pr }] = await Promise.all([
      supabase.from('ads').select('*').order('created_at', { ascending: false }),
      supabase.rpc('admin_ad_stats'),
      supabase.from('shop_products').select('id, name, price, status').neq('status', 'removed').order('name'),
    ]);
    if (error) alert('Could not load ads: ' + error.message);
    setRows(data || []);
    const m: Record<string, any> = {}; (st || []).forEach((r: any) => { m[r.ad_id] = r; });
    setStats(m);
    setProducts(pr || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function upload(file: File, which: 'media' | 'poster') {
    const isVideo = file.type.startsWith('video/');
    if (!isVideo && !file.type.startsWith('image/')) { alert('Choose a photo or a video.'); return; }
    if (which === 'poster' && isVideo) { alert('The cover must be a photo.'); return; }
    if (file.size > 40 * 1024 * 1024) { alert('Please keep the file under 40 MB (a 15–30 second video is ideal).'); return; }
    setUploading(which);
    try {
      const ext = (file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
      const path = `ads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const up = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) { alert('Upload failed: ' + up.error.message); return; }
      const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      setEdit((cur: any) => which === 'media' ? { ...cur, media_url: url, media_type: isVideo ? 'video' : 'photo' } : { ...cur, poster_url: url });
    } finally { setUploading(''); }
  }

  function toggleIn(key: 'placements' | 'target_states' | 'target_types', v: string) {
    setEdit((cur: any) => {
      const list: string[] = cur[key] ?? [];
      return { ...cur, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] };
    });
  }

  async function save() {
    const e = edit;
    if (!e.title.trim()) { alert('Title is required.'); return; }
    if (!e.media_url) { alert('Upload a photo or video.'); return; }
    if (!e.product_id && !/^https:\/\//.test(e.link.trim())) { alert('Pick a Shop product, or give a link starting with https:// (e.g. https://wa.me/91…).'); return; }
    if (!e.placements.length) { alert('Choose at least one place to show the ad.'); return; }
    if (e.media_type === 'video' && e.placements.some((p: string) => p !== 'reel') && !e.poster_url) {
      if (!confirm('This is a video. The bird page and Shop show a still picture — add a cover photo? (Cancel = save anyway)')) { /* save anyway */ } else return;
    }
    setSaving(true);
    const payload: any = {
      title: e.title.trim(), subtitle: e.subtitle.trim() || null, sponsor: e.sponsor.trim() || 'Rooster Club Nutrition',
      media_url: e.media_url, media_type: e.media_type, poster_url: e.poster_url || null,
      product_id: e.product_id || null, link: e.link.trim() || null, cta_label: e.cta_label.trim() || null,
      price: e.price === '' ? null : Number(e.price), placements: e.placements,
      target_states: e.target_states.length ? e.target_states : null, target_types: e.target_types.length ? e.target_types : null,
      starts_at: e.starts_at ? new Date(e.starts_at).toISOString() : new Date().toISOString(),
      ends_at: e.ends_at ? new Date(e.ends_at).toISOString() : null,
      status: e.status, max_per_day: Math.max(1, Math.min(20, Number(e.max_per_day) || 2)), priority: Number(e.priority) || 0,
    };
    const { error } = e.id ? await supabase.from('ads').update(payload).eq('id', e.id) : await supabase.from('ads').insert(payload);
    setSaving(false);
    if (error) { alert('Could not save: ' + error.message); return; }
    setEdit(null); load();
  }

  async function setStatus(r: any, status: string) {
    if (status === 'ended' && !confirm('End this ad? It stops showing. You can still see its numbers.')) return;
    const { error } = await supabase.from('ads').update({ status }).eq('id', r.id);
    if (error) { alert('Could not update: ' + error.message); return; }
    setRows((x) => x.map((a) => a.id === r.id ? { ...a, status } : a));
  }

  const liveNow = (r: any) => r.status === 'active' && new Date(r.starts_at) <= new Date() && (!r.ends_at || new Date(r.ends_at) > new Date());

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="h1">Ads</h1>
          <p className="sub">Your own products in the app — Sponsored reels, bird page card, Shop Featured. No app update needed.</p>
        </div>
        <button className="btn" onClick={() => setEdit({ ...blank })}><Plus size={15} style={{ verticalAlign: -3 }} /> New ad</button>
      </div>

      <div className="card">
        <div className="card-h"><h2><Megaphone size={16} /> Ads ({rows.length})</h2></div>
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No ads yet. Click “New ad”." /> : (
          <table>
            <thead><tr><th></th><th>Ad</th><th>Shows on</th><th>Runs</th><th>Views</th><th>People</th><th>Taps</th><th>Tap rate</th><th>Orders</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const s = stats[r.id] || {};
                const views = Number(s.views || 0), taps = Number(s.taps || 0);
                const thumb = r.media_type === 'video' ? r.poster_url : r.media_url;
                const prod = products.find((p) => p.id === r.product_id);
                return (
                  <tr key={r.id} style={r.status !== 'active' ? { opacity: .6 } : undefined}>
                    <td>{thumb ? <img className="thumb" src={thumb} /> : <div className="thumb" />}</td>
                    <td><b>{r.title}</b><div className="muted">{prod ? prod.name : r.link}{r.price ? ' · ' + inr(r.price) : ''}{r.media_type === 'video' ? ' · video' : ''}</div></td>
                    <td className="muted">{(r.placements || []).map((p: string) => PLACES.find((x) => x.value === p)?.label).join(', ')}
                      {r.target_states?.length ? <div>{r.target_states.join(', ')}</div> : null}
                      {r.target_types?.length ? <div>{r.target_types.join(', ')}</div> : null}</td>
                    <td className="muted">{timeAgo(r.starts_at)}{r.ends_at ? ' → ' + new Date(r.ends_at).toLocaleDateString('en-IN') : ' → no end'}<div>max {r.max_per_day}/day per person</div></td>
                    <td>{views}</td>
                    <td>{s.viewers ?? 0}</td>
                    <td>{taps}</td>
                    <td>{views ? ((taps / views) * 100).toFixed(1) + '%' : '—'}</td>
                    <td>{r.product_id ? (s.orders ?? 0) : '—'}</td>
                    <td><span className={'badge ' + (liveNow(r) ? 'b-ok' : 'b-mut')}>{liveNow(r) ? 'live' : r.status}</span></td>
                    <td><div className="row-acts">
                      <button className="btn ghost sm" onClick={() => setEdit({
                        ...blank, ...r, subtitle: r.subtitle ?? '', poster_url: r.poster_url ?? '', product_id: r.product_id ?? '', link: r.link ?? '',
                        cta_label: r.cta_label ?? '', price: r.price ?? '', target_states: r.target_states ?? [], target_types: r.target_types ?? [],
                        starts_at: dt(r.starts_at), ends_at: dt(r.ends_at), max_per_day: String(r.max_per_day), priority: String(r.priority),
                      })}><Pencil size={12} /> Edit</button>
                      {r.status === 'active' && <button className="btn ghost sm" onClick={() => setStatus(r, 'paused')}>Pause</button>}
                      {r.status === 'paused' && <button className="btn ok sm" onClick={() => setStatus(r, 'active')}>Resume</button>}
                      {r.status !== 'ended' && <button className="btn danger sm" onClick={() => setStatus(r, 'ended')}>End</button>}
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Edit ad' : 'New ad'} onClose={() => setEdit(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn" onClick={save} disabled={saving || !!uploading}>{saving ? 'Saving…' : 'Save ad'}</button>
          </>}>
          <label style={{ display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer', border: '2px dashed var(--line, #E3D9C9)', borderRadius: 12, padding: 14 }}>
            {edit.media_url
              ? (edit.media_type === 'video'
                ? <video src={edit.media_url} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} muted />
                : <img src={edit.media_url} className="thumb" style={{ width: 72, height: 72 }} />)
              : <div className="thumb" style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImagePlus size={22} /></div>}
            <div>
              <div style={{ fontWeight: 600 }}>{uploading === 'media' ? 'Uploading…' : 'Photo or video — click to choose'}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Upright (9:16) works best in reels. Video: 15–30 seconds, under 40 MB.</div>
            </div>
            <input type="file" accept="image/*,video/mp4" hidden onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, 'media'); }} />
          </label>
          {edit.media_type === 'video' && (
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', marginTop: 8 }}>
              {edit.poster_url ? <img src={edit.poster_url} className="thumb" /> : <div className="thumb" />}
              <span className="muted">{uploading === 'poster' ? 'Uploading…' : 'Cover photo for the video (shown on the bird page and Shop)'}</span>
              <input type="file" accept="image/*" hidden onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, 'poster'); }} />
            </label>
          )}
          <Field label="Title (shown big)"><input maxLength={80} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="e.g. Gamefowl Booster — strength and stamina" /></Field>
          <Field label="Short text (optional)"><input maxLength={140} value={edit.subtitle} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} /></Field>
          <div className="grid2">
            <Field label="Sponsor name"><input maxLength={60} value={edit.sponsor} onChange={(e) => setEdit({ ...edit, sponsor: e.target.value })} /></Field>
            <Field label="Price shown (₹, optional)"><input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
          </div>
          <div className="grid2">
            <Field label="Opens this Shop product">
              <select value={edit.product_id} onChange={(e) => setEdit({ ...edit, product_id: e.target.value })}>
                <option value="">— none (use the link) —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {inr(p.price)}{p.status !== 'active' ? ' (' + p.status + ')' : ''}</option>)}
              </select>
            </Field>
            <Field label="…or this link (https://, e.g. WhatsApp)"><input value={edit.link} onChange={(e) => setEdit({ ...edit, link: e.target.value })} placeholder="https://wa.me/91XXXXXXXXXX" /></Field>
          </div>
          <div className="grid2">
            <Field label="Button text (optional)"><input maxLength={24} value={edit.cta_label} onChange={(e) => setEdit({ ...edit, cta_label: e.target.value })} placeholder="Buy now" /></Field>
            <Field label="Max times per person per day"><input type="number" min={1} max={20} value={edit.max_per_day} onChange={(e) => setEdit({ ...edit, max_per_day: e.target.value })} /></Field>
          </div>
          <Field label="Show on">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {PLACES.map((p) => <label key={p.value}><input type="checkbox" checked={edit.placements.includes(p.value)} onChange={() => toggleIn('placements', p.value)} /> {p.label}</label>)}
            </div>
          </Field>
          <Field label="Only these states (none ticked = everyone)">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {STATES.map((st) => <label key={st}><input type="checkbox" checked={edit.target_states.includes(st)} onChange={() => toggleIn('target_states', st)} /> {st}</label>)}
            </div>
          </Field>
          <Field label="Only these bird types (none ticked = all)">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {TYPES.map((t) => <label key={t.value}><input type="checkbox" checked={edit.target_types.includes(t.value)} onChange={() => toggleIn('target_types', t.value)} /> {t.label}</label>)}
            </div>
          </Field>
          <div className="grid2">
            <Field label="Starts (blank = now)"><input type="datetime-local" value={edit.starts_at} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value })} /></Field>
            <Field label="Ends (blank = no end)"><input type="datetime-local" value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></Field>
          </div>
          <div className="grid2">
            <Field label="Status">
              <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                <option value="active">active</option><option value="paused">paused</option><option value="ended">ended</option>
              </select>
            </Field>
            <Field label="Priority (higher shows first)"><input type="number" value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
