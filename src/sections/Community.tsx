import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { MessagesSquare, Pin, Trash2, Eye, VolumeX, Volume2 } from 'lucide-react';
import { Modal, Empty, Loading, timeAgo } from '../ui';

export default function Community({ onChange }: { onChange?: () => void }) {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewThread, setViewThread] = useState<any | null>(null);
  const [replies, setReplies] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('forum_threads')
      .select('*, users!forum_threads_user_id_fkey(id, full_name, handle, forum_muted_until)')
      .eq('status', 'active').order('last_reply_at', { ascending: false }).limit(200);
    if (error) alert('Could not load discussions: ' + error.message);
    setThreads(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

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

  const authorName = (u: any) => u?.full_name || (u?.handle ? '@' + u.handle : '—');

  return (
    <>
      <h1 className="h1">Community</h1>
      <p className="sub">Moderate the Forum. Removing hides content from the app instantly. Muting stops a user posting in the forum without banning them.</p>

      <div className="card">
        <div className="card-h"><h2><MessagesSquare size={16} /> Threads ({threads.length})</h2></div>
        {loading ? <Loading /> : (
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
    </>
  );
}
