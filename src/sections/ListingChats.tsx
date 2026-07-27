import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Modal, timeAgo } from '../ui';
import { ChevronLeft, ArrowRight } from 'lucide-react';
import ChatMessages from './ChatMessages';

type Thread = {
  chat_id: string; buyer_id: string; buyer_name: string; buyer_handle: string;
  seller_id: string; seller_name: string; seller_handle: string;
  last_message: string; last_message_at: string; msg_count: number;
};

const who = (name: string, handle: string) =>
  name || (handle ? '@' + handle : '—');

export default function ListingChats({ listingId, onClose }:{
  listingId: string; onClose: () => void;
}) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [active, setActive] = useState<Thread | null>(null);

  useEffect(() => {
    supabase.rpc('admin_listing_chats', { p_listing: listingId })
      .then(({ data, error }) => setThreads(error ? [] : (data || [])));
  }, [listingId]);

  const title = active
    ? `${who(active.buyer_name, active.buyer_handle)} ↔ ${who(active.seller_name, active.seller_handle)}`
    : 'Conversations on this listing';

  return (
    <Modal title={title} onClose={onClose}>
      {!active ? (
        threads === null ? <div className="loading">Loading…</div>
        : threads.length === 0 ? <div className="empty">No one has chatted about this listing yet.</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {threads.map(t => (
              <button key={t.chat_id} onClick={() => setActive(t)}
                style={{ textAlign: 'left', background: 'var(--glass)', border: '1px solid var(--line)',
                  borderRadius: 10, padding: '10px 12px', cursor: 'pointer', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {who(t.buyer_name, t.buyer_handle)} <span className="muted" style={{ fontWeight: 400 }}>(buyer)</span>
                    {' ↔ '}{who(t.seller_name, t.seller_handle)} <span className="muted" style={{ fontWeight: 400 }}>(seller)</span>
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
        )
      ) : (
        <>
          <button className="btn ghost sm" onClick={() => setActive(null)} style={{ marginBottom: 10 }}>
            <ChevronLeft size={13} /> All conversations
          </button>
          <ChatMessages chatId={active.chat_id} sellerId={active.seller_id} />
        </>
      )}
    </Modal>
  );
}
