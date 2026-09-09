import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { MessagesSquare, Search, ChevronLeft, ArrowRight } from 'lucide-react';
import { Empty, Loading, timeAgo, inr, UserLink, ListingLink } from '../ui';
import ChatMessages from './ChatMessages';

type Thread = {
  chat_id: string; listing_id: string | null; listing_breed: string | null;
  listing_type: string | null; listing_price: number | null; listing_status: string | null;
  listing_district: string | null; listing_state: string | null; listing_photo: string | null;
  product_id: string | null; product_name: string | null;
  buyer_id: string; buyer_name: string; buyer_handle: string;
  seller_id: string; seller_name: string; seller_handle: string;
  last_message: string; last_message_at: string; msg_count: number;
};

const who = (name: string, handle: string) =>
  name || (handle ? '@' + handle : '—');

// live / pending / sold / expired — one word, colour-coded, so you can see at a
// glance whether the thing being discussed is still buyable.
const STATUS_CLASS: Record<string, string> = {
  live: 'b-ok', pending: 'b-warn', sold: 'b-info', expired: 'b-mut', removed: 'b-danger',
};

/** The listing (or shop product) a conversation is about. */
function Subject({ t }: { t: Thread }) {
  if (t.listing_breed) {
    return (
      <div className="chat-subj">
        {t.listing_photo
          ? <img src={t.listing_photo} alt="" className="chat-thumb" loading="lazy" />
          : <div className="chat-thumb chat-thumb-none">🐓</div>}
        <div style={{ minWidth: 0 }}>
          <div className="chat-subj-t">
            <ListingLink id={t.listing_id}>{t.listing_breed}</ListingLink>
            {t.listing_status && (
              <span className={'badge ' + (STATUS_CLASS[t.listing_status] || 'b-mut')}>{t.listing_status}</span>
            )}
          </div>
          <div className="chat-subj-s">
            {[t.listing_type, t.listing_price ? inr(t.listing_price) : null,
              t.listing_district].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
    );
  }
  if (t.product_name) {
    return (
      <div className="chat-subj">
        <div className="chat-thumb chat-thumb-none">🛒</div>
        <div className="chat-subj-t">{t.product_name}<span className="badge b-mut">shop</span></div>
      </div>
    );
  }
  return (
    <div className="chat-subj">
      <div className="chat-thumb chat-thumb-none">💬</div>
      <div className="chat-subj-s">Direct conversation — not about a listing</div>
    </div>
  );
}

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
        <p className="sub">{active.msg_count} messages</p>
        {/* The listing stays in view while you read the thread — otherwise you
            lose track of which bird the haggling is about. */}
        <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
          <Subject t={active} />
        </div>
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
              // a div, not a button: it now contains buttons (the 360 links) and
              // nesting buttons is invalid HTML. role+tabIndex+key handler keep it
              // operable from the keyboard.
              <div key={t.chat_id} role="button" tabIndex={0} onClick={() => setActive(t)}
                onKeyDown={e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setActive(t); } }}
                style={{ textAlign: 'left', background: 'var(--glass)', border: '1px solid var(--line)',
                  borderRadius: 10, padding: '10px 12px', cursor: 'pointer', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* What they're talking about, first — it is the thing you
                      actually scan this list for. */}
                  <Subject t={t} />
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>
                    {/* both parties open their own 360 — the card itself still
                        opens the thread (the links stop propagation) */}
                    <UserLink id={t.buyer_id} title="Open buyer 360">{who(t.buyer_name, t.buyer_handle)}</UserLink>
                    <span className="muted" style={{ fontWeight: 400 }}> ↔ </span>
                    <UserLink id={t.seller_id} title="Open seller 360">{who(t.seller_name, t.seller_handle)}</UserLink>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
