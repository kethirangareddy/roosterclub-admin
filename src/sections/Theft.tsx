import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Siren, Trash2, Eye, CheckCircle2, IndianRupee } from 'lucide-react';
import { Modal, Empty, Loading, timeAgo } from '../ui';

// New-style media array (photos + videos), falling back to the legacy single photo_url.
function mediaOf(r: any): { url: string; type?: string }[] {
  const arr = Array.isArray(r?.media) ? r.media.filter((m: any) => m?.url) : [];
  if (arr.length === 0 && r?.photo_url) return [{ url: r.photo_url, type: 'image' }];
  return arr;
}

export default function Theft({ onChange }: { onChange?: () => void }) {
  const [theft, setTheft] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTheft, setViewTheft] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('theft_alerts')
      .select('*, users!theft_alerts_user_id_fkey(full_name, handle)')
      .eq('status', 'active').order('created_at', { ascending: false }).limit(200);
    if (error) alert('Could not load theft alerts: ' + error.message);
    setTheft(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function resolveTheft(id: string) {
    const { error } = await supabase.from('theft_alerts').update({ status: 'resolved' }).eq('id', id);
    if (error) { alert(error.message); return; }
    setTheft(t => t.filter(x => x.id !== id)); onChange?.();
  }
  async function removeTheft(id: string) {
    if (!confirm('Remove this theft alert? It will be hidden from the app.')) return;
    const { error } = await supabase.from('theft_alerts').update({ status: 'removed' }).eq('id', id);
    if (error) { alert(error.message); return; }
    setTheft(t => t.filter(x => x.id !== id)); onChange?.();
  }

  const authorName = (u: any) => u?.full_name || (u?.handle ? '@' + u.handle : '—');

  return (
    <>
      <h1 className="h1">Theft Alerts</h1>
      <p className="sub">Stolen-bird reports from members. Resolve when recovered or handled; Remove hides it from the app instantly.</p>

      <div className="card">
        <div className="card-h"><h2><Siren size={16} /> Active theft alerts ({theft.length})</h2></div>
        {loading ? <Loading /> : (
          theft.length === 0 ? <Empty text="No active theft alerts." /> : (
            <table>
              <thead><tr><th></th><th>Report</th><th>Reward</th><th>Area</th><th>By</th><th>Posted</th><th></th></tr></thead>
              <tbody>
                {theft.map(r => {
                  const media = mediaOf(r);
                  return (
                    <tr key={r.id}>
                      <td style={{ position: 'relative' }}>
                        {media[0] ? <img className="thumb" src={media[0].url} style={{ cursor: 'pointer' }} onClick={() => setViewTheft(r)} /> : <div className="thumb" />}
                        {media.length > 1 && <span className="badge b-info" style={{ position: 'absolute', bottom: 6, left: 34, fontSize: 10, padding: '1px 6px' }}>+{media.length - 1}</span>}
                      </td>
                      <td><b>{r.bird_breed || 'Bird theft'}</b><div className="muted" style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div></td>
                      <td>{r.reward_amount ? <span className="badge b-ok"><IndianRupee size={10} />{Number(r.reward_amount).toLocaleString('en-IN')}</span> : <span className="muted">—</span>}</td>
                      <td className="muted">{[r.district, r.state].filter(Boolean).join(', ') || '—'}</td>
                      <td className="muted">{authorName(r.users)}</td>
                      <td className="muted">{timeAgo(r.created_at)}</td>
                      <td><div className="row-acts">
                        <button className="btn ghost sm" onClick={() => setViewTheft(r)}><Eye size={13} /> View</button>
                        <button className="btn ok sm" onClick={() => resolveTheft(r.id)}><CheckCircle2 size={13} /> Resolve</button>
                        <button className="btn danger sm" onClick={() => removeTheft(r.id)}><Trash2 size={13} /> Remove</button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </div>

      {viewTheft && (
        <Modal title={viewTheft.bird_breed || 'Theft alert'} onClose={() => setViewTheft(null)}>
          <div className="muted" style={{ fontSize: 13 }}>
            {[viewTheft.district, viewTheft.state].filter(Boolean).join(', ') || '—'} · by {authorName(viewTheft.users)} · {timeAgo(viewTheft.created_at)}
          </div>
          {viewTheft.reward_amount ? <div><span className="badge b-ok" style={{ fontSize: 13 }}><IndianRupee size={12} />{Number(viewTheft.reward_amount).toLocaleString('en-IN')} reward offered</span></div> : null}
          {viewTheft.description && <p style={{ margin: 0 }}>{viewTheft.description}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
            {mediaOf(viewTheft).map((m, i) => m.type === 'video'
              ? <video key={i} src={m.url} controls style={{ width: '100%', borderRadius: 10, background: '#000', aspectRatio: '1' }} />
              : <a key={i} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} /></a>
            )}
            {mediaOf(viewTheft).length === 0 && <div className="muted">No photos or videos attached.</div>}
          </div>
        </Modal>
      )}
    </>
  );
}
