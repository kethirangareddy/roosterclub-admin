import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { MessagesSquare, Siren, Pin, Trash2, Eye, CheckCircle2 } from 'lucide-react';
import { Modal, Empty, Loading, timeAgo } from '../ui';

type Tab = 'forum' | 'theft';

export default function Community({ onChange }: { onChange?: () => void }) {
  const [tab, setTab] = useState<Tab>('forum');
  const [threads, setThreads] = useState<any[]>([]);
  const [theft, setTheft] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewThread, setViewThread] = useState<any | null>(null);
  const [replies, setReplies] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    if (tab === 'forum') {
      const { data, error } = await supabase.from('forum_threads')
        .select('*, users!forum_threads_user_id_fkey(full_name, handle)')
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
      .select('*, users!forum_replies_user_id_fkey(full_name, handle)')
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
      <p className="sub">Moderate the Forum and Theft alerts. Removing hides content from the app instantly.</p>

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
                    <td className="muted">{authorName(r.users)}</td>
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
              <thead><tr><th></th><th>Report</th><th>Area</th><th>By</th><th>Posted</th><th></th></tr></thead>
              <tbody>
                {theft.map(r => (
                  <tr key={r.id}>
                    <td>{r.photo_url ? <img className="thumb" src={r.photo_url} /> : <div className="thumb" />}</td>
                    <td><b>{r.bird_breed || 'Bird theft'}</b><div className="muted" style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div></td>
                    <td className="muted">{[r.district, r.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="muted">{authorName(r.users)}</td>
                    <td className="muted">{timeAgo(r.created_at)}</td>
                    <td><div className="row-acts">
                      <button className="btn ok sm" onClick={() => resolveTheft(r.id)}><CheckCircle2 size={13} /> Resolve</button>
                      <button className="btn danger sm" onClick={() => removeTheft(r.id)}><Trash2 size={13} /> Remove</button>
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
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{viewThread.category} · {viewThread.state} · by {authorName(viewThread.users)}</div>
          {viewThread.body && <p style={{ marginTop: 0 }}>{viewThread.body}</p>}
          <div style={{ fontWeight: 600, margin: '10px 0 6px' }}>Replies ({replies.length})</div>
          {replies.length === 0 ? <div className="muted">No replies.</div> : replies.map(rp => (
            <div key={rp.id} style={{ borderTop: '1px solid var(--line)', padding: '8px 0', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div><b style={{ fontSize: 13 }}>{authorName(rp.users)}</b><div style={{ fontSize: 13.5 }}>{rp.body}</div></div>
              <button className="btn danger sm" onClick={() => removeReply(rp.id)}><Trash2 size={12} /></button>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}
