import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { MessagesSquare, Search, ChevronLeft, ArrowRight } from 'lucide-react';
import { Empty, Loading, timeAgo } from '../ui';
import ChatMessages from './ChatMessages';

type Thread = {
  chat_id: string; listing_id: string | null; listing_breed: string | null;
  buyer_id: string; buyer_name: string; buyer_handle: string;
  seller_id: string; seller_name: string; seller_handle: string;
  last_message: string; last_message_at: string; msg_count: number;
};

const who = (name: string, handle: string) =>
  name || (handle ? '@' + handle : '—');

export default function Chats() {
  const [rows, setRows] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [active, setActive] = useState<Thread | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_all_chats', { p_q: q.trim() || null, p_limit: 200 });
    if (error) alert('Could not load chats: ' + error.message);
    setRows(data || []); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (active) {
    return (
      <>
        <button className="btn ghost sm" onClick={() => setActive(null)} style={{ marginBottom: 12 }}>
          <ChevronLeft size={14} /> All chats
        </button>
        <h1 className="h1" style={{ marginTop: 0 }}>
          {who(active.buyer_name, active.buyer_handle)} ↔ {who(active.seller_name, active.seller_handle)}
        </h1>
        <p className="sub">{active.listing_breed ? 'About: ' + active.listing_breed : 'Direct conversation'} · {active.msg_count} messages</p>
        <div className="card"><ChatMessages chatId={active.chat_id} sellerId={active.seller_id} /></div>
      </>
    );
  }

  return (
    <>
      <h1 className="h1">Chats</h1>
      <p className="sub">Every buyer↔seller conversation on the platform. Tap one to read the full thread.</p>
      <div className="card">
        <div className="card-h">
          <h2><MessagesSquare size={16} /> Conversations ({rows.length})</h2>
          <div className="toolbar">
            <input placeholder="Search name / handle / breed / text…" value={q}
              onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} style={{ width: 260 }} />
            <button className="btn ghost sm" onClick={load}><Search size={14} /> Search</button>
          </div>
        </div>
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No conversations match this search." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(t => (
              <button key={t.chat_id} onClick={() => setActive(t)}
                style={{ textAlign: 'left', background: 'var(--glass)', border: '1px solid var(--line)',
                  borderRadius: 10, padding: '10px 12px', cursor: 'pointer', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {who(t.buyer_name, t.buyer_handle)} <span className="muted" style={{ fontWeight: 400 }}>↔</span> {who(t.seller_name, t.seller_handle)}
                    {t.listing_breed && <span className="badge b-mut" style={{ marginLeft: 8 }}>{t.listing_breed}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.last_message || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="muted" style={{ fontSize: 11 }}>{t.msg_count} msgs</div>
                  <div className="muted" style={{ fontSize: 11 }}>{t.last_message_at ? timeAgo(t.last_message_at) : ''}</div>
                  <ArrowRight size={13} style={{ color: 'var(--muted)' }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
