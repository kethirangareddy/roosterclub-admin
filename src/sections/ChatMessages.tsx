import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { timeAgo } from '../ui';

type Msg = {
  id: string; sender_id: string; sender_name: string; content: string;
  type: string; created_at: string; deleted: boolean; attachment_name: string | null;
};

// Non-text messages carry a URL/label in content; show a friendly summary instead.
function body(m: Msg) {
  if (m.deleted) return '🚫 message deleted';
  switch (m.type) {
    case 'image': return '📷 photo';
    case 'audio': return '🎤 voice note';
    case 'document': return '📎 ' + (m.attachment_name || 'file');
    case 'location_share': return '📍 location shared';
    case 'phone_share': return '📞 phone number shared';
    case 'payment_request': return '🧾 payment request';
    default: return m.content || '—';
  }
}

// Reusable buyer↔seller transcript for one chat. Seller right/gold, buyer left.
export default function ChatMessages({ chatId, sellerId }:{ chatId: string; sellerId: string }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);

  useEffect(() => {
    setMsgs(null);
    supabase.rpc('admin_chat_messages', { p_chat: chatId })
      .then(({ data, error }) => setMsgs(error ? [] : (data || [])));
  }, [chatId]);

  if (msgs === null) return <div className="loading">Loading messages…</div>;
  if (msgs.length === 0) return <div className="empty">No messages in this conversation.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {msgs.map(m => {
        const isSeller = m.sender_id === sellerId;
        return (
          <div key={m.id} style={{ display: 'flex', justifyContent: isSeller ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '78%', background: isSeller ? '#BA7517' : 'var(--glass)',
              color: isSeller ? '#fff' : 'var(--ink)', border: '1px solid ' + (isSeller ? '#BA7517' : 'var(--line)'),
              borderRadius: 12, padding: '7px 11px' }}>
              <div style={{ fontSize: 10.5, opacity: 0.8, marginBottom: 2 }}>
                {m.sender_name || '—'} · {isSeller ? 'seller' : 'buyer'}
              </div>
              <div style={{ fontSize: 13.5, fontStyle: m.deleted ? 'italic' : 'normal', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {body(m)}
              </div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3, textAlign: 'right' }}>{timeAgo(m.created_at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
