import { useEffect, useState } from 'react';
import { Trophy, Phone } from 'lucide-react';
import { supabase } from '../supabase';
import { UserLink } from '../ui';

// Top-active leaderboard for the Command Center.
// Data: admin_top_active(p_days, p_sort, p_limit) — admin-only RPC.
// Days active comes from user_daily_active (one row per user per IST day).
// Handles listed in app_config.leaderboard_hide_handles (the founder's own
// account etc.) are left out.

type Row = {
  user_id: string; name: string; handle: string | null; phone: string | null;
  district: string | null; state: string | null; active_days: number;
  last_active: string | null; messages: number; listings: number; sold: number; live_now: number;
};

const SORTS = [
  { k: 'active', label: 'Most active' },
  { k: 'listings', label: 'Most listings' },
] as const;
const PERIODS = [7, 30, 90] as const;

function fmtPhone(p: string | null) {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  const local = d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
  return local.length === 10 ? `${local.slice(0, 5)} ${local.slice(5)}` : p;
}

export default function TopActive() {
  const [sort, setSort] = useState<'active' | 'listings'>('active');
  const [days, setDays] = useState<number>(30);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let live = true;
    setBusy(true); setErr(null);
    supabase.rpc('admin_top_active', { p_days: days, p_sort: sort, p_limit: 25 }).then(({ data, error }) => {
      if (!live) return;
      if (error) setErr(error.message); else setRows((data as Row[]) || []);
      setBusy(false);
    });
    return () => { live = false; };
  }, [sort, days]);

  const shown = showAll ? rows : rows.slice(0, 10);

  return (
    <div className="card">
      <div className="card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2><Trophy size={16} /> Top active members</h2>
        <div className="tabbar" style={{ margin: 0, marginLeft: 'auto' }}>
          {SORTS.map(s => (
            <button key={s.k} className={sort === s.k ? 'active' : ''} onClick={() => setSort(s.k)}>{s.label}</button>
          ))}
          {PERIODS.map(p => (
            <button key={p} className={days === p ? 'active' : ''} onClick={() => setDays(p)}>{p}d</button>
          ))}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th>
            <th>Member</th>
            <th>District</th>
            <th className="right">Days active</th>
            <th className="right">Messages</th>
            <th className="right">Listings</th>
            <th className="right">Sold</th>
            <th>Phone</th>
          </tr>
        </thead>
        <tbody>
          {busy && rows.length === 0 && <tr><td colSpan={8} className="empty">Loading…</td></tr>}
          {err && <tr><td colSpan={8} className="empty">Couldn’t load — {err}</td></tr>}
          {!busy && !err && rows.length === 0 && <tr><td colSpan={8} className="empty">No activity in this period.</td></tr>}
          {shown.map((r, i) => (
            <tr key={r.user_id} style={{ opacity: busy ? 0.55 : 1 }}>
              <td className="muted">{i + 1}</td>
              <td>
                <UserLink id={r.user_id}><span style={{ fontWeight: 600 }}>{r.name}</span></UserLink>
                {r.handle && <div className="muted" style={{ fontSize: 11 }}>@{r.handle}</div>}
              </td>
              <td>{r.district || <span className="muted">—</span>}</td>
              <td className="right" style={{ fontWeight: sort === 'active' ? 700 : 400 }}>
                {r.active_days}<span className="muted" style={{ fontSize: 11 }}>/{days}</span>
              </td>
              <td className="right">{r.messages}</td>
              <td className="right" style={{ fontWeight: sort === 'listings' ? 700 : 400 }}>{r.listings}</td>
              <td className="right" style={{ color: r.sold ? 'var(--ok)' : undefined }}>{r.sold}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {r.phone
                  ? <a href={`tel:+${r.phone.replace(/\D/g, '')}`} title="Call"><Phone size={12} style={{ verticalAlign: -1 }} /> {fmtPhone(r.phone)}</a>
                  : <span className="muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 && (
        <div style={{ padding: '8px 18px 12px' }}>
          <button className="btn sm ghost" onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Show top 10' : `Show top ${rows.length}`}
          </button>
        </div>
      )}
    </div>
  );
}
