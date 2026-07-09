import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { MessagesSquare, Siren, Pin, Trash2, Eye, CheckCircle2, VolumeX, Volume2, IndianRupee } from 'lucide-react';
import { Modal, Empty, Loading, timeAgo, useParamState } from '../ui';

type Tab = 'forum' | 'theft';

// New-style media array (photos + videos), falling back to the legacy single photo_url.
function mediaOf(r: any): { url: string; type?: string }[] {
  const arr = Array.isArray(r?.media) ? r.media.filter((m: any) => m?.url) : [];
  if (arr.length === 0 && r?.photo_url) return [{ url: r.photo_url, type: 'image' }];
  return arr;
}

export default function Community({ onChange }: { onChange?: () => void }) {
  const [tab, setTab] = useParamState<Tab>('tab', 'forum');
  const [threads, setThreads] = useState<any[]>([]);
  const [theft, setTheft] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewThread, setViewThread] = useState<any | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [viewTheft, setViewTheft] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    if (tab === 'forum') {
      const { data, error } = await supabase.from('forum_threads')
        .select('*, users!forum_threads_user_id_fkey(id, full_name, handle, forum_muted_until)')
        .eq('status', 'active').order('last_reply_at', { ascending: false }).limit(200);
      if (error) alert('Could not load discussions: ' + error.message);
      setThreads(data || []);
    } else {
      const { data, error } = await supabase.from('theft_alerts')
        .select('*, users!theft_alerts_user_id_fkey(full_name, handle)')
        .eq('status', 'active').order('created_at', { ascending: false }).limit(200);
      if (error) alert('Could not load theft alerts: ' + error.message);
      setTheft(data || []);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [tab]);

  async function removeThread(id: string) {
    if (!confirm('Remove this discussion? It will be hidden from the app.')) return;
    const { error } = await supabase.from('forum_threads').update({ status: 'removed' }).eq('id', id);
    if (error) { alert(error.message); return; }
    setThreads(t => t.filter(x => x.id !== id)); onChange?.();
  }
  async function togglePin(r: any) {
    const { error } = await supabase.from('forum_threads').update({ pinned: !r.pinned }).eq('id', r.id);
    if (error) { alert(error.message); return; }
    setThreads(t => t.map(x => x.id === r.id ? { ...x, pinned: !x.pinned } : x));
  }
  async function openReplies(t: any) {
    setViewThread(t);
    const { data } = await supabase.from('forum_replies')
      .select('*, users!forum_replies_user_id_fkey(id, full_name, handle, forum_muted_until)')
      .eq('thread_id', t.id).order('created_at', { ascending: true });
    setReplies(data || []);
  }
  async function removeReply(id: string) {
    // Hard delete — confirm first (the only destructive action here without one).
    if (!confirm('Delete this reply? This cannot be undone.')) return;
    const { error } = await supabase.from('forum_replies').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    setReplies(r => r.filter(x => x.id !== id));
  }

  // ---- user-level mute: RLS blocks new threads/replies until forum_muted_until passes ----
  const isMuted = (u: any) => !!u?.forum_muted_until && new Date(u.forum_muted_until) > new Date();
  async function muteUser(u: any, days = 7) {
    if (!u?.id) return;
    if (!confirm(`Mute ${u.full_name || '@' + (u.handle || 'user')} for ${days} days? They can read the forum but can't post or reply.`)) return;
    const until = new Date(Date.now() + days * 864e5).toISOString();
    const { error } = await supabase.from('users').update({ forum_muted_until: until }).eq('id', u.id);
    if (error) { alert('Could not mute: ' + error.message); return; }
    patchUser(u.id, until);
  }
  async function unmuteUser(u: any) {
    if (!u?.id) return;
    const { error } = await supabase.from('users').update({ forum_muted_until: null }).eq('id', u.id);
    if (error) { alert('Could not unmute: ' + error.message); return; }
    patchUser(u.id, null);
  }
  function patchUser(userId: string, until: string | null) {
    const patch = (u: any) => u?.id === userId ? { ...u, forum_muted_until: until } : u;
    setThreads(t => t.map(x => ({ ...x, users: patch(x.users) })));
    setReplies(r => r.map(x => ({ ...x, users: patch(x.users) })));
    setViewThread((v: any) => v ? { ...v, users: patch(v.users) } : v);
  }
  function MuteBtn({ u }: { u: any }) {
    if (!u?.id) return null;
    return isMuted(u)
      ? <button className="btn ghost sm" title={'Muted until ' + new Date(u.forum_muted_until).toLocaleDateString('en-IN')} onClick={() => unmuteUser(u)}><Volume2 size={12} /> Unmute</button>
      : <button className="btn ghost sm" onClick={() => muteUser(u)}><VolumeX size={12} /> Mute 7d</button>;
  }

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
      <h1 className="h1">Community</h1>
      <p className="sub">Moderate the Forum and Theft alerts. Removing hides content from the app instantly. Muting stops a user posting in the forum without banning them.</p>

      <div className="tabbar">
        <button className={tab === 'forum' ? 'active' : ''} onClick={() => setTab('forum')}><MessagesSquare size={13} style={{ verticalAlign: -2 }} /> Forum</button>
        <button className={tab === 'theft' ? 'active' : ''} onClick={() => setTab('theft')}><Siren size={13} style={{ verticalAlign: -2 }} /> Theft alerts</button>
      </div>

      <div className="card">
        <div className="card-h"><h2>{tab === 'forum' ? <><MessagesSquare size={16} /> Threads ({threads.length})</> : <><Siren size={16} /> Theft alerts ({theft.length})</>}</h2></div>
        {loading ? <Loading /> : tab === 'forum' ? (
          threads.length === 0 ? <Empty text="No discussions yet." /> : (
            <table>
              <thead><tr><th>Title</th><th>State</th><th>Category</th><th>Author</th><th>Replies</th><th>Activity</th><th></th></tr></thead>
              <tbody>
                {threads.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.pinned ? '📌 ' : ''}{r.title}</b>{r.body && <div className="muted" style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.body}</div>}</td>
                    <td className="muted">{r.state}</td>
                    <td><span className="badge b-mut">{r.category || 'General'}</span></td>
                    <td className="muted">{authorName(r.users)}{isMuted(r.users) && <span className="badge b-danger" style={{ marginLeft: 6 }}>muted</span>}</td>
                    <td>{r.reply_count}</td>
                    <td className="muted">{timeAgo(r.last_reply_at)}</td>
                    <td><div className="row-acts">
                      <button className="btn ghost sm" onClick={() => openReplies(r)}><Eye size={13} /> View</button>
                      <button className="btn ghost sm" onClick={() => togglePin(r)}><Pin size={13} /> {r.pinned ? 'Unpin' : 'Pin'}</button>
                      <button className="btn danger sm" onClick={() => removeThread(r.id)}><Trash2 size={13} /> Remove</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
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

      {viewThread && (
        <Modal title={viewThread.title} onClose={() => setViewThread(null)}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{viewThread.category} · {viewThread.state} · by {authorName(viewThread.users)}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
            <MuteBtn u={viewThread.users} />
            {isMuted(viewThread.users) && <span className="badge b-danger">muted until {new Date(viewThread.users.forum_muted_until).toLocaleDateString('en-IN')}</span>}
          </div>
          {viewThread.body && <p style={{ marginTop: 0 }}>{viewThread.body}</p>}
          <div style={{ fontWeight: 600, margin: '10px 0 6px' }}>Replies ({replies.length})</div>
          {replies.length === 0 ? <div className="muted">No replies.</div> : replies.map(rp => (
            <div key={rp.id} style={{ borderTop: '1px solid var(--line)', padding: '8px 0', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <b style={{ fontSize: 13 }}>{authorName(rp.users)}</b>
                {isMuted(rp.users) && <span className="badge b-danger" style={{ marginLeft: 6 }}>muted</span>}
                <div style={{ fontSize: 13.5 }}>{rp.body}</div>
              </div>
              <div className="row-acts" style={{ flexShrink: 0 }}>
                <MuteBtn u={rp.users} />
                <button className="btn danger sm" onClick={() => removeReply(rp.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </Modal>
      )}

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
