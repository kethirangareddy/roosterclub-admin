import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { History, Search } from 'lucide-react';
import { Empty, Loading, timeAgo } from '../ui';

/** Item 15 — audit log. Every admin action (ban, approve, verify, delete, badge…)
    is captured by DB triggers into admin_audit; this is the searchable view. */

// "banned: false → true · badge: null → gold_star"
function diffText(detail: any): string {
  if (!detail || typeof detail !== 'object') return '—';
  const parts: string[] = [];
  for (const [k, v] of Object.entries<any>(detail)) {
    if (v && typeof v === 'object' && ('from' in v || 'to' in v)) {
      parts.push(`${k}: ${fmt(v.from)} → ${fmt(v.to)}`);
    } else {
      parts.push(`${k}: ${fmt(v)}`);
    }
  }
  return parts.join(' · ') || '—';
}
function fmt(v: any): string {
  if (v == null) return '∅';
  if (typeof v === 'string') return v.length > 24 ? v.slice(0, 24) + '…' : v;
  return JSON.stringify(v);
}

const ACT_BADGE: Record<string, string> = { update: 'b-info', delete: 'b-danger', insert: 'b-ok' };

export default function Activity() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_audit_log', { p_q: q.trim() || null, p_limit: 200 });
    if (error) alert('Could not load activity: ' + error.message);
    setRows(data || []); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <>
      <h1 className="h1">Activity</h1>
      <p className="sub">Your own audit trail — every admin change (ban, approve, verify, badge, delete) is logged automatically. “Did I delete that? When?” lives here.</p>
      <div className="card">
        <div className="card-h">
          <h2><History size={16}/> Admin actions ({rows.length})</h2>
          <div className="toolbar">
            <input placeholder="Search action, id, detail…" value={q} style={{ width: 240 }}
              onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}/>
            <button className="btn ghost sm" onClick={load}><Search size={14}/> Search</button>
          </div>
        </div>
        {loading ? <Loading/> : rows.length === 0 ? <Empty text="No admin actions logged yet — they start appearing as you approve, ban, verify…"/> : (
          <table>
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>What changed</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const op = r.action.split('.').pop() || 'update';
                return (
                  <tr key={r.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }} title={new Date(r.at).toLocaleString('en-IN')}>{timeAgo(r.at)}</td>
                    <td className="muted">{r.admin_email || '—'}</td>
                    <td><span className={'badge ' + (ACT_BADGE[op] || 'b-mut')}>{r.action}</span></td>
                    <td className="muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.target_id ? r.target_id.slice(0, 8) : '—'}</td>
                    <td style={{ maxWidth: 380, fontSize: 12.5 }}>{diffText(r.detail)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
