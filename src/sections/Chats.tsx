import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { MessagesSquare, Search, ChevronLeft, ArrowRight } from 'lucide-react';
import { Empty, Loading, timeAgo, inr, UserLink, ListingLink, getParam, setParam } from '../ui';
import { toast } from '../feedback';
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

function useWide(min = 1100) {
  const q = `(min-width:${min}px)`;
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q); const f = () => setWide(m.matches);
    m.addEventListener('change', f); return () => m.removeEventListener('change', f);
  }, []);
  return wide;
}

export default function Chats() {
  const [rows, setRows] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'listing' | 'shop' | 'direct'>('all');
  const [showEmpty, setShowEmpty] = useState(false);
  // The open thread lives in the URL (?chat=<id>): Back returns to the list
  // and a refresh reopens the same conversation.
  const [activeId, setActiveId] = useState<string | null>(() => getParam('chat'));
  const reqRef = useRef(0);
  // The search that was actually run (Enter / Search) — the 30s background
  // refresh reuses it, not whatever is half-typed in the box.
  const qRef = useRef('');
  const wide = useWide();

  async function load(quiet = false) {
    if (!quiet) qRef.current = q;
    const my = ++reqRef.current;
    if (!quiet) setLoading(true);
    const { data, error } = await supabase.rpc('admin_all_chats', { p_q: qRef.current.trim() || null, p_limit: 300 });
    if (my !== reqRef.current) return; // an older search finished late — ignore it
    if (error) { if (!quiet) toast('Could not load chats: ' + error.message); setLoadErr(true); setLoading(false); return; }
    setLoadErr(false);
    setRows(data || []); setLoading(false);
  }
  useEffect(() => {
    load();
    // New messages show up on their own — the list refreshes every 30s.
    const t = setInterval(() => { if (!document.hidden) load(true); }, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const onPop = () => setActiveId(getParam('chat'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  function openChat(id: string) {
    if (id === activeId) return;
    const u = new URL(location.href); u.searchParams.set('chat', id);
    // Side-by-side: switching threads replaces the address (no Back trail per
    // click). Phone: opening pushes, so Back returns to the list.
    // Already in a thread (e.g. tapping "their other chats"): swap in place,
    // so "All chats" / Back always returns to the list, not the previous chat.
    if (activeId) history.replaceState(history.state, '', u);
    else history.pushState({ rcChat: true }, '', u);
    setActiveId(id);
    if (!wide) window.scrollTo(0, 0);
  }
  function close() { if (history.state?.rcChat) history.back(); else { setParam('chat', null); setActiveId(null); } }

  // Same two people can have several chats — one per bird. Count them so each
  // row says "chat 2 of 3 between them" instead of looking like a duplicate.
  const pairs = useMemo(() => {
    const m = new Map<string, Thread[]>();
    // Siblings for the open thread: every chat of the pair except empty ones
    // while those are hidden (a "· 0" button opens a blank thread).
    rows.filter(t => showEmpty || t.msg_count > 0)
      .forEach(t => { const k = pairKey(t.buyer_id, t.seller_id); m.set(k, [...(m.get(k) || []), t]); });
    return m;
  }, [rows, showEmpty]);
  const kindOf = (t: Thread) => t.listing_id ? 'listing' : t.product_id ? 'shop' : 'direct';
  const emptyCount = rows.filter(t => !t.msg_count).length;
  const shown = rows.filter(t => (showEmpty || t.msg_count > 0) && (filter === 'all' || kindOf(t) === filter));
  const shownPairs = new Map<string, Thread[]>();
  shown.forEach(t => { const k = pairKey(t.buyer_id, t.seller_id); shownPairs.set(k, [...(shownPairs.get(k) || []), t]); });
  // Keep showing the open thread even if a new search no longer lists it.
  const lastActive = useRef<Thread | null>(null);
  const found = activeId ? rows.find(t => t.chat_id === activeId) || null : null;
  if (found) lastActive.current = found;
  const active = found || (lastActive.current?.chat_id === activeId ? lastActive.current : null);

  const list = (
    <div className={'card chat-list' + (wide ? ' pane' : '')}>
      <div className="chat-list-h">
        <div className="chat-search">
          <Search size={15} />
          <input placeholder="Search name, breed, district, text…" value={q}
            onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <div className="seg">
          {(['all', 'listing', 'shop', 'direct'] as const).map(f => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'listing' ? 'Birds' : f === 'shop' ? 'Shop' : 'Direct'}
            </button>
          ))}
        </div>
        {emptyCount > 0 && (
          <label className="chat-empty-tg">
            <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} />
            include {emptyCount} chats with no messages
          </label>
        )}
      </div>
      <div className="chat-list-b">
        {loading ? <Loading /> : shown.length === 0 ? <Empty text="No conversations match." /> : shown.map(t => {
          // Badge counts only what's in this list right now (both filters).
          // The open thread's "Their other chats" lists every chat the two have
          // that has messages (plus empty ones when "include empty" is ticked).
          const group = shownPairs.get(pairKey(t.buyer_id, t.seller_id)) || [];
          const nth = group.length > 1 ? group.findIndex(x => x.chat_id === t.chat_id) + 1 : 0;
          return (
            // ONE tap target: the whole row opens this thread. Names are plain
            // text here (they're links inside the thread).
            <div key={t.chat_id} role="button" tabIndex={0}
              className={'chat-row' + (t.chat_id === activeId ? ' on' : '')} onClick={() => openChat(t.chat_id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChat(t.chat_id); } }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <SubjectStatic t={t} />
                <div className="chat-people">
                  {who(t.buyer_name, t.buyer_handle)}<span className="muted"> ↔ </span>{who(t.seller_name, t.seller_handle)}
                  {nth > 0 && <span className="badge b-mut">{nth} of {group.length} between them</span>}
                </div>
                <div className="chat-last">
                  {t.msg_count ? (t.last_message || '—') : 'No messages yet'}
                </div>
              </div>
              <div className="chat-meta">
                <div>{t.last_message_at ? timeAgo(t.last_message_at) : ''}</div>
                <div>{t.msg_count} msgs</div>
              </div>
            </div>
          );
        })}
      </div>
      {!loading && rows.length >= 300 && (
        <div className="chat-list-f">Showing the newest 300 conversations. Search to find older ones.</div>
      )}
    </div>
  );

  const thread = active ? (
    <ThreadView key={active.chat_id} t={active} siblings={(pairs.get(pairKey(active.buyer_id, active.seller_id)) || []).filter(x => x.chat_id !== active.chat_id)}
      onOpen={openChat} onClose={wide ? undefined : close} />
  ) : activeId ? (
    <div className="card pane chat-thread">
      {!wide && <button className="btn ghost sm" onClick={close} style={{ margin: 12 }}><ChevronLeft size={14} /> All chats</button>}
      {loading ? <Loading /> : loadErr ? <div className="empty" style={{ color: 'var(--danger)' }}>Couldn't load chats — check the connection; it retries every 30 seconds.</div> : <Empty text="This conversation isn't in the newest 300. Search one of the names to find it." />}
    </div>
  ) : (
    <div className="card pane chat-thread chat-none">
      <MessagesSquare size={28} />
      <div>Pick a conversation on the left to read it.</div>
    </div>
  );

  return (
    <>
      <h1 className="h1">Member chats</h1>
      <p className="sub">Every buyer↔seller conversation, newest first. Updates by itself every 30 seconds.</p>
      {wide
        ? <div className="chat-split">{list}{thread}</div>
        : (activeId ? thread : list)}
    </>
  );
}

function ThreadView({ t, siblings, onOpen, onClose }: {
  t: Thread; siblings: Thread[]; onOpen: (id: string) => void; onClose?: () => void;
}) {
  return (
    <div className="card pane chat-thread">
      <div className="chat-thread-h">
        {onClose && <button className="btn ghost sm" onClick={onClose}><ChevronLeft size={14} /> All chats</button>}
        <div className="chat-thread-who">
          <UserLink id={t.buyer_id}>{who(t.buyer_name, t.buyer_handle)}</UserLink>
          <span className="muted"> buyer · </span>
          <UserLink id={t.seller_id}>{who(t.seller_name, t.seller_handle)}</UserLink>
          <span className="muted"> seller</span>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{t.msg_count} messages · last {t.last_message_at ? timeAgo(t.last_message_at) : '—'}</div>
        {/* What they're haggling over stays pinned above the messages. */}
        <div className="chat-pin"><Subject t={t} /></div>
        {siblings.length > 0 && (
          <div className="chat-sibs">
            <span className="muted">Their other chats:</span>
            {siblings.map(x => (
              <button key={x.chat_id} className="btn ghost sm" onClick={() => onOpen(x.chat_id)}>
                {x.listing_breed || x.product_name || 'Direct'} · {x.msg_count}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="chat-thread-b">
        <ChatMessages chatId={t.chat_id} sellerId={t.seller_id} live />
      </div>
    </div>
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
