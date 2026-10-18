// Category how-to videos (18 Oct 2026). Stored in shop_categories.video =
// {url, poster, title_en, title_te, duration}. The app shows it as a card on the category
// page and on every product page in that category (BSF Farming first). Changes here go
// live in the app with no build.
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Film, Pencil, Upload } from 'lucide-react';
import { Loading, Modal, Field } from '../ui';
import { toast, ask } from '../feedback';

type Video = { url: string; poster?: string; title_en?: string; title_te?: string; duration?: string };
type Cat = { key: string; name_en: string; name_te: string | null; active: boolean; video: Video | null };

const blank: Video = { url: '', poster: '', title_en: '', title_te: '', duration: '' };

function mmss(sec: number) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function CategoryVideos() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<{ key: string; name: string; v: Video } | null>(null);
  const [busy, setBusy] = useState<'' | 'video' | 'poster' | 'save'>('');
  const [watch, setWatch] = useState<Cat | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('shop_categories')
      .select('key, name_en, name_te, active, video').order('sort');
    if (error) toast('Could not load categories: ' + error.message);
    setCats((data as Cat[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function upload(file: File, kind: 'video' | 'poster') {
    if (kind === 'video' && file.type !== 'video/mp4') { toast('Please choose an .mp4 video.'); return; }
    if (kind === 'poster' && !file.type.startsWith('image/')) { toast('Please choose a picture.'); return; }
    if (kind === 'video' && file.size > 50 * 1024 * 1024) { toast('Video is over 50 MB. Compress it first (720p is plenty).'); return; }
    setBusy(kind);
    try {
      const ext = (file.name.split('.').pop() || (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase();
      const path = `admin/category-videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const up = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: true });
      if (up.error) { toast('Upload failed: ' + up.error.message); return; }
      const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      setEdit((cur) => cur && ({ ...cur, v: kind === 'video' ? { ...cur.v, url } : { ...cur.v, poster: url } }));
    } finally { setBusy(''); }
  }

  async function save() {
    if (!edit) return;
    if (!edit.v.url.trim()) { toast('Add a video first.'); return; }
    setBusy('save');
    const v: Video = {
      url: edit.v.url.trim(),
      poster: edit.v.poster?.trim() || undefined,
      title_en: edit.v.title_en?.trim() || undefined,
      title_te: edit.v.title_te?.trim() || undefined,
      duration: edit.v.duration?.trim() || undefined,
    };
    const { error } = await supabase.from('shop_categories').update({ video: v }).eq('key', edit.key);
    setBusy('');
    if (error) { toast('Could not save: ' + error.message); return; }
    toast('Video saved. It shows in the app now.');
    setEdit(null); load();
  }

  async function removeVideo(c: Cat) {
    if (!await ask(`Remove the video from ${c.name_en}? The card disappears from the app.`)) return;
    const { error } = await supabase.from('shop_categories').update({ video: null }).eq('key', c.key);
    if (error) { toast('Could not remove: ' + error.message); return; }
    load();
  }

  return (
    <div className="card">
      <div className="card-h"><h2><Film size={16} /> Category videos</h2></div>
      <p className="muted" style={{ marginTop: -4, marginBottom: 10, fontSize: 12.5 }}>
        A how-to video shows as a gold card at the top of the category page and on every product page in it.
        Buyers only see it once the category is switched on.
      </p>
      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
          {cats.map((c) => (
            <div key={c.key} style={{ border: '1px solid var(--line, #E3D9C9)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
              {c.video ? (
                <button onClick={() => setWatch(c)} title="Watch"
                  style={{ display: 'block', width: '100%', padding: 0, border: 0, cursor: 'pointer', position: 'relative', aspectRatio: '16 / 9', background: '#2a1a0c' }}>
                  {c.video.poster && <img src={c.video.poster} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 46, height: 46, borderRadius: 23, background: '#9C7A2E', border: '3px solid rgba(255,255,255,.9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, paddingLeft: 3 }}>▶</span>
                  {c.video.duration && <span style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(20,12,6,.78)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 7px' }}>{c.video.duration}</span>}
                </button>
              ) : (
                <div style={{ aspectRatio: '16 / 9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBF6E9', color: '#9C7A2E', fontSize: 12.5 }}>No video</div>
              )}
              <div style={{ padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <b>{c.name_en}</b>
                  <span className={'badge ' + (c.active ? 'b-ok' : 'b-mut')}>{c.active ? 'on' : 'off'}</span>
                </div>
                {c.video && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{c.video.title_te || c.video.title_en}</div>}
                <div className="row-acts" style={{ marginTop: 8 }}>
                  <button className="btn ghost sm" onClick={() => setEdit({ key: c.key, name: c.name_en, v: { ...blank, ...(c.video ?? {}) } })}>
                    <Pencil size={12} /> {c.video ? 'Edit' : 'Add video'}
                  </button>
                  {c.video && <button className="btn danger sm" onClick={() => removeVideo(c)}>Remove</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {watch?.video && (
        <Modal title={`${watch.name_en} — ${watch.video.title_en || 'video'}`} onClose={() => setWatch(null)}
          footer={<button className="btn ghost" onClick={() => setWatch(null)}>Close</button>}>
          <video src={watch.video.url} poster={watch.video.poster} controls autoPlay playsInline
            style={{ width: '100%', borderRadius: 10, background: '#000', aspectRatio: '16 / 9' }} />
        </Modal>
      )}

      {edit && (
        <Modal title={`Video for ${edit.name}`} onClose={() => setEdit(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn" onClick={save} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save video'}</button>
          </>}>
          {edit.v.url ? (
            <video key={edit.v.url} src={edit.v.url} poster={edit.v.poster || undefined} controls playsInline
              onLoadedMetadata={(e) => {
                const d = (e.target as HTMLVideoElement).duration;
                if (isFinite(d) && d > 0) setEdit((cur) => cur && ({ ...cur, v: { ...cur.v, duration: mmss(d) } }));
              }}
              style={{ width: '100%', borderRadius: 10, background: '#000', aspectRatio: '16 / 9' }} />
          ) : (
            <div style={{ aspectRatio: '16 / 9', borderRadius: 10, background: '#FBF6E9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9C7A2E' }}>No video yet</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
            <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
              <Upload size={12} /> {busy === 'video' ? 'Uploading video…' : 'Upload video (.mp4)'}
              <input type="file" accept="video/mp4" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, 'video'); e.target.value = ''; }} />
            </label>
            <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
              <Upload size={12} /> {busy === 'poster' ? 'Uploading picture…' : 'Upload cover picture'}
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, 'poster'); e.target.value = ''; }} />
            </label>
          </div>
          <div className="grid2">
            <Field label="Title in Telugu"><input value={edit.v.title_te ?? ''} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, title_te: e.target.value } })} /></Field>
            <Field label="Title in English"><input value={edit.v.title_en ?? ''} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, title_en: e.target.value } })} /></Field>
          </div>
          <div className="grid2">
            <Field label="Length (filled in from the video)"><input value={edit.v.duration ?? ''} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, duration: e.target.value } })} placeholder="10:35" /></Field>
            <div />
          </div>
          <Field label="Video link (set by the upload, or paste one)"><input value={edit.v.url} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, url: e.target.value } })} /></Field>
          <Field label="Cover picture link"><input value={edit.v.poster ?? ''} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, poster: e.target.value } })} /></Field>
        </Modal>
      )}
    </div>
  );
}
