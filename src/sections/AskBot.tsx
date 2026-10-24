import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { Bot, Send, Sun, ShieldAlert, MessageSquareReply, RefreshCw, Copy } from 'lucide-react';
import { toast } from '../feedback';

/** Ask bot — an admin helper that runs on Ollama on THIS computer (free).
    The browser talks to http://localhost:11434 directly; the model can only call
    the read-only admin_bot_tool menu (admin-only RPC, no phones/addresses/KYC).
    Nothing the bot does changes data or sends messages. */
const OLLAMA = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5:14b';
// 8k context keeps the whole 14b model on a 12 GB RTX 3060 (16k pushed 6 layers onto the CPU).
const CTX = 8192;
// Keep the model loaded for an hour so each question doesn't reload it (~15 s).
const KEEP = '1h';

const TOOLS = [
  ['stats', 'Counts for today and the last 7 days: new users, listings, live listings, sold, chats, receipts, shop orders, active users.', {}],
  ['pending', 'What is waiting for the team: KYC, listings waiting approval, support threads waiting, open reports, shop orders to handle.', {}],
  ['users_by_district', 'New users per district.', { days: 'number of days back (1-90, default 7)', limit: 'max rows (default 10)' }],
  ['listings_by_district', 'Listings and sold per district.', { days: 'days back (default 7)', limit: 'max rows' }],
  ['top_sellers', 'Sellers with the most sales/listings.', { days: 'days back (default 7)', limit: 'max rows' }],
  ['recent_listings', 'Newest listings with breed, price, district and description text. Use this to check listings.', { limit: 'how many (default 10, max 30)' }],
  ['support_waiting', 'Support chats waiting for a team reply, with their last messages. Use this to draft replies.', { limit: 'max threads (default 10)' }],
  ['shop_orders', 'Recent shop orders.', { status: 'optional status filter', limit: 'max rows' }],
  ['reports_open', 'Open user reports.', { limit: 'max rows' }],
].map(([name, description, props]: any) => ({
  type: 'function',
  function: {
    name, description,
    parameters: { type: 'object', properties: Object.fromEntries(Object.entries(props).map(([k, d]) => [k, { type: k === 'status' ? 'string' : 'integer', description: d }])) },
  },
}));

const SYSTEM = `You are the private admin assistant for Rooster Club (a Telugu poultry marketplace app in India). You talk only to Ranga, the founder.
- Get every number from the tools. Never guess or invent numbers, names or dates. If a tool returns nothing, say so.
- You can only READ. You cannot approve, delete, ban, send or change anything — tell Ranga what to do in the Command Center instead.
- Be short and clear. Use simple English unless Ranga writes in Telugu.
- Times from tools are UTC; India is UTC+5:30.
- When checking listings, flag: anything about rooster fighting, fight training, betting or cruelty; anything that is not a live bird / hatching eggs / chicks (feed, medicine, BSF, accessories are NOT allowed as listings); phone numbers or UPI ids written in the description; very odd prices; abusive words. Say which listing (breed, seller handle, id) and why. If nothing is wrong, say so.
- When drafting support replies, write a short, polite reply in the user's language (their "language" field: te = Telugu, en = English). Do not promise refunds or actions; say the team will check. Mark each draft clearly with the user's name.`;

const QUICK = [
  { label: 'Morning summary', Icon: Sun, q: 'Give me my morning summary: use stats and pending, then tell me in 6 short lines how yesterday/today went and what needs my attention first.' },
  { label: 'Check new listings', Icon: ShieldAlert, q: 'Check the 20 newest listings (recent_listings with limit 20) and flag any that break the rules. List only the problem ones.' },
  { label: 'Draft support replies', Icon: MessageSquareReply, q: 'Look at support chats waiting for a reply and draft a reply for each one.' },
];

type Msg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: any[]; tool_name?: string };

export default function AskBot() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string>(() => { try { return localStorage.getItem('askbot.model') || DEFAULT_MODEL; } catch { return DEFAULT_MODEL; } });
  const [chat, setChat] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function check() {
    setStatus('checking');
    try {
      const r = await fetch(`${OLLAMA}/api/tags`);
      const j = await r.json();
      const names: string[] = (j.models ?? []).map((m: any) => m.name);
      setModels(names);
      setStatus('ok');
      const warm = names.includes(model) ? model : (names.find(n => n.startsWith('qwen')) ?? names[0]);
      if (warm) fetch(`${OLLAMA}/api/generate`, { method: 'POST', body: JSON.stringify({ model: warm, prompt: '', keep_alive: KEEP, options: { num_ctx: CTX } }) }).catch(() => {});
      if (names.length && !names.includes(model)) setModel(names.find(n => n.startsWith('qwen')) ?? names[0]);
    } catch { setStatus('down'); }
  }
  useEffect(() => { check(); }, []);
  useEffect(() => { try { localStorage.setItem('askbot.model', model); } catch { /* ignore */ } }, [model]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, busy]);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    const history: Msg[] = [...chat, { role: 'user', content: q.trim() }];
    setChat(history); setText('');
    let msgs: Msg[] = [{ role: 'system', content: SYSTEM }, ...history.filter(m => m.role === 'user' || (m.role === 'assistant' && !m.tool_calls))];
    try {
      for (let round = 0; round < 6; round++) {
        setBusy(round === 0 ? 'Thinking…' : 'Reading data…');
        const r = await fetch(`${OLLAMA}/api/chat`, {
          method: 'POST',
          body: JSON.stringify({ model, messages: msgs, tools: TOOLS, stream: false, keep_alive: KEEP, options: { temperature: 0.2, num_ctx: CTX } }),
        });
        if (!r.ok) throw new Error(`Ollama ${r.status}: ${(await r.text()).slice(0, 200)}`);
        const j = await r.json();
        const m = j.message ?? {};
        const calls = m.tool_calls ?? [];
        if (!calls.length) {
          setChat(c => [...c, { role: 'assistant', content: String(m.content ?? '').trim() || '(no answer)' }]);
          return;
        }
        msgs = [...msgs, { role: 'assistant', content: m.content ?? '', tool_calls: calls }];
        for (const c of calls) {
          const name = c.function?.name; const args = c.function?.arguments ?? {};
          const { data, error } = await supabase.rpc('admin_bot_tool', { p_name: name, p_args: args });
          const out = error ? { error: error.message } : data;
          msgs.push({ role: 'tool', tool_name: name, content: JSON.stringify(out).slice(0, 8000) });
        }
      }
      setChat(c => [...c, { role: 'assistant', content: 'I needed too many steps for that — try asking more simply.' }]);
    } catch (e: any) {
      setChat(c => [...c, { role: 'assistant', content: `Could not reach Ollama on this computer. ${e?.message ?? ''}` }]);
      check();
    } finally { setBusy(null); }
  }

  const bubble = (m: Msg, i: number) => (
    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '85%', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5, padding: '10px 12px', borderRadius: 12,
        background: m.role === 'user' ? 'var(--gold, #8A6516)' : 'var(--glass)', color: m.role === 'user' ? '#fff' : 'inherit', border: m.role === 'user' ? 'none' : '1px solid var(--line)' }}>
        {m.content}
        {m.role === 'assistant' && <div style={{ textAlign: 'right', marginTop: 6 }}>
          <button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(m.content); toast('Copied', 'ok'); }}><Copy size={12} /> Copy</button>
        </div>}
      </div>
    </div>
  );

  return (
    <div>
      <p className="sub">A free helper that runs on Ollama on this computer. It can only read numbers and lists — it never changes anything or sends messages. Check its answers before acting.</p>

      {status === 'down' && (
        <div className="card"><div style={{ padding: 16, fontSize: 13.5, display: 'grid', gap: 8 }}>
          <b>Can't reach Ollama on this computer.</b>
          <div>1. Open the Ollama app (llama icon near the clock).</div>
          <div>2. One-time setup — open Command Prompt and run:<br /><code>setx OLLAMA_ORIGINS "https://admin.roosterclub.co.in"</code><br />then quit Ollama from the llama icon and open it again.</div>
          <div>3. If Chrome asks to allow this site to "access other apps and services on this device", press <b>Allow</b>.</div>
          <div>4. This only works on the computer where Ollama is installed.</div>
          <div><button className="btn sm" onClick={check}><RefreshCw size={14} /> Try again</button></div>
        </div></div>
      )}

      <div className="card">
        <div className="card-h"><h2><Bot size={16} /> Ask bot</h2>
          <span className={'badge ' + (status === 'ok' ? 'b-ok' : status === 'down' ? 'b-danger' : '')} style={{ marginLeft: 'auto' }}>
            {status === 'ok' ? 'Connected' : status === 'down' ? 'Offline' : 'Checking…'}</span>
          {models.length > 0 && <select value={model} onChange={e => setModel(e.target.value)} style={{ marginLeft: 8 }}>
            {models.map(n => <option key={n} value={n}>{n}</option>)}</select>}
        </div>
        <div style={{ padding: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {QUICK.map(({ label, Icon, q }) => (
            <button key={label} className="btn ghost sm" disabled={status !== 'ok' || !!busy} onClick={() => ask(q)}><Icon size={14} /> {label}</button>
          ))}
          {chat.length > 0 && <button className="btn ghost sm" style={{ marginLeft: 'auto' }} disabled={!!busy} onClick={() => setChat([])}>New chat</button>}
        </div>
        <div style={{ padding: '0 16px 16px', display: 'grid', gap: 10, minHeight: 120, maxHeight: '55vh', overflowY: 'auto' }}>
          {chat.length === 0 && <div className="sub" style={{ margin: 0 }}>Try: "How many new users this week, by district?" or "What needs my attention today?"</div>}
          {chat.map(bubble)}
          {busy && <div className="sub" style={{ margin: 0 }}>{busy}</div>}
          <div ref={endRef} />
        </div>
        <form style={{ display: 'flex', gap: 8, padding: 16, borderTop: '1px solid var(--line)' }} onSubmit={e => { e.preventDefault(); ask(text); }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Ask about users, listings, orders, support…" style={{ flex: 1 }} disabled={status !== 'ok'} />
          <button className="btn" disabled={status !== 'ok' || !!busy || !text.trim()}><Send size={14} /> Ask</button>
        </form>
      </div>
    </div>
  );
}
