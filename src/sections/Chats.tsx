import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { MessagesSquare, Search, ChevronLeft, ArrowRight } from 'lucide-react';
import { Empty, Loading, timeAgo, inr, UserLink, ListingLink, getParam, setParam } from '../ui';
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

const pairKey = (a: string, b: string) => (a < b ? a + '|' + b : b + '|' + a);

export default function Chats() {
  const [rows, setRows] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  // The open thread lives in the URL (?chat=<id>): the phone's Back button
  // returns to the list instead of jumping to some other screen, and a
  // refresh reopens the same conversation.
  const [activeId, setActiveId] = useState<string | null>(() => getParam('chat'));
  const reqRef = useRef(0);

  async function load() {
    const my = ++reqRef.current;
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_all_chats', { p_q: q.trim() || null, p_limit: 300 });
    if (my !== reqRef.current) return; // an older search finished late — ignore it
    if (error) console.error('Could not load chats: ' + error.message);
    setRows(data || []); setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onPop = () => setActiveId(getParam('chat'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  function close() { if (history.state?.rcChat) history.back(); else { setParam('chat', null); setActiveId(null); } }
  function openFromList(id: string) {
    const u = new URL(location.href); u.searchParams.set('chat', id);
    history.pushState({ rcChat: true }, '', u); setActiveId(id); window.scrollTo(0, 0);
  }

  // Same two people can have several chats — one per bird. Count them so each
  // row says "chat 2 of 3 between them" instead of looking like a duplicate.
  const pairs = useMemo(() => {
    const m = new Map<string, Thread[]>();
    rows.forEach(t => { const k = pairKey(t.buyer_id, t.seller_id); m.set(k, [...(m.get(k) || []), t]); });
    return m;
  }, [rows]);
  const emptyCount = rows.filter(t => !t.msg_count).length;
  const shown = showEmpty ? rows : rows.filter(t => t.msg_count > 0);
  const active = activeId ? rows.find(t => t.chat_id === activeId) || null : null;

  if (activeId) {
    if (!active) {
      return (
        <>
          <button className="btn ghost sm" onClick={close} style={{ marginBottom: 12 }}><ChevronLeft size={14} /> All chats</button>
          {loading ? <Loading /> : <Empty text="This conversation isn't in the latest 300 chats. Search for one of the names to find it." />}
        </>
      );
    }
    const siblings = (pairs.get(pairKey(active.buyer_id, active.seller_id)) || []).filter(t => t.chat_id !== active.chat_id);
    return (
      <>
        <button className="btn ghost sm" onClick={close} style={{ marginBottom: 12 }}>
          <ChevronLeft size={14} /> All chats
        </button>
        <h1 className="h1" style={{ marginTop: 0 }}>
          <UserLink id={active.buyer_id}>{who(active.buyer_name, active.buyer_handle)}</UserLink>
          <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}> buyer </span>
          ↔ <UserLink id={active.seller_id}>{who(active.seller_name, active.seller_handle)}</UserLink>
          <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}> seller</span>
        </h1>
        <p className="sub">{active.msg_count} messages · last {active.last_message_at ? timeAgo(active.last_message_at) : '—'}</p>
        {/* The listing stays in view while you read the thread — otherwise you
            lose track of which bird the haggling is about. */}
        <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
          <Subject t={active} />
        </div>
        {siblings.length > 0 && (
          <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              These two also have {siblings.length} other chat{siblings.length > 1 ? 's' : ''} — each about a different listing:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {siblings.map(t => (
                <button key={t.chat_id} className="btn ghost sm" onClick={() => openFromList(t.chat_id)}>
                  {t.listing_breed || t.product_name || 'Direct chat'} · {t.msg_count} msgs
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="card"><ChatMessages key={active.chat_id} chatId={active.chat_id} sellerId={active.seller_id} /></div>
      </>
    );
  }

  return (
    <>
      <h1 className="h1">Chats</h1>
      <p className="sub">Every buyer↔seller conversation, newest first. Tap a row to read it.</p>
      <div className="card">
        <div className="card-h">
          <h2><MessagesSquare size={16} /> Conversations ({shown.length})</h2>
          <div className="toolbar">
            <input placeholder="Search name / handle / breed / text…" value={q}
              onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} style={{ width: 260 }} />
            <button className="btn ghost sm" onClick={load}><Search size={14} /> Search</button>
            {emptyCount > 0 && (
              <label className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} />
                show {emptyCount} with no messages
              </label>
            )}
          </div>
        </div>
        {loading ? <Loading /> : shown.length === 0 ? <Empty text="No conversations match this search." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map(t => {
              const group = pairs.get(pairKey(t.buyer_id, t.seller_id)) || [];
              const nth = group.length > 1 ? group.findIndex(x => x.chat_id === t.chat_id) + 1 : 0;
              return (
                // ONE tap target: the whole row opens this thread. Names are
                // plain text here (they're links inside the thread), so a tap
                // can never land on "the wrong thing".
                <div key={t.chat_id} role="button" tabIndex={0} className="chat-row" onClick={() => openFromList(t.chat_id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFromList(t.chat_id); } }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <SubjectStatic t={t} />
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>
                      {who(t.buyer_name, t.buyer_handle)}
                      <span className="muted" style={{ fontWeight: 400 }}> ↔ </span>
                      {who(t.seller_name, t.seller_handle)}
                      {nth > 0 && <span className="badge b-mut" style={{ marginLeft: 6 }}>chat {nth} of {group.length} between them</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.msg_count ? (t.last_message || '—') : 'No messages yet — chat opened but nobody wrote'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="muted" style={{ fontSize: 11 }}>{t.msg_count} msgs</div>
                    <div className="muted" style={{ fontSize: 11 }}>{t.last_message_at ? timeAgo(t.last_message_at) : ''}</div>
                    <ArrowRight size={13} style={{ color: 'var(--muted)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/** Row version of Subject: no links inside, so the row has a single tap target. */
function SubjectStatic({ t }: { t: Thread }) {
  return (
    <div className="chat-subj">
      {t.listing_breed
        ? (t.listing_photo ? <img src={t.listing_photo} alt="" className="chat-thumb" loading="lazy" /> : <div className="chat-thumb chat-thumb-none">🐓</div>)
        : <div className="chat-thumb chat-thumb-none">{t.product_name ? '🛒' : '💬'}</div>}
      <div style={{ minWidth: 0 }}>
        <div className="chat-subj-t">
          {t.listing_breed || t.product_name || 'Direct conversation'}
          {t.listing_status && <span className={'badge ' + (STATUS_CLASS[t.listing_status] || 'b-mut')}>{t.listing_status}</span>}
          {!t.listing_breed && t.product_name && <span className="badge b-mut">shop</span>}
        </div>
        {t.listing_breed && (
          <div className="chat-subj-s">
            {[t.listing_type, t.listing_price ? inr(t.listing_price) : null, t.listing_district].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}
