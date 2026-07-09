import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { IndianRupee, Rocket, Star, Hourglass, RefreshCcw, Users, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Empty, Loading, inr } from '../ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

/** Items 17+18 — Money Desk: boost/feature revenue, pending-UPI queue with aging,
    repeat buyers, and the receipts reconciliation sheet (months → days → receipts). */

const RANGES = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '12 months', days: 365 },
];
const fmtDay = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtMonth = (s: string) => new Date(s).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
const daysWaiting = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);

const tt = {
  background: '#FFFFFF', border: '1px solid rgba(20,30,55,.14)', borderRadius: 10,
  color: '#1B2436', fontSize: 12, boxShadow: '0 8px 24px rgba(20,30,55,.14)',
} as const;

export default function Money({ openReceipt, go }: { openReceipt: (id: string) => void; go: (k: any) => void }) {
  const [days, setDays] = useState(30);
  const [m, setM] = useState<any | null>(null);
  const [months, setMonths] = useState<any[]>([]);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [daysRows, setDaysRows] = useState<any[]>([]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dayReceipts, setDayReceipts] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setErr(null);
    const to = new Date().toISOString();
    const from = new Date(Date.now() - days * 864e5).toISOString();
    (async () => {
      const [mo, re] = await Promise.all([
        supabase.rpc('admin_money', { p_from: from, p_to: to }),
        supabase.rpc('admin_recon_months', { p_months: 12 }),
      ]);
      if (!alive) return;
      if (mo.error || re.error) { setErr((mo.error || re.error)!.message); return; }
      setM(mo.data); setMonths(re.data || []);
    })();
    return () => { alive = false; };
  }, [days]);

  async function toggleMonth(month: string) {
    if (openMonth === month) { setOpenMonth(null); setOpenDay(null); return; }
    setOpenMonth(month); setOpenDay(null);
    const { data, error } = await supabase.rpc('admin_recon_days', { p_month: month });
    if (error) { alert(error.message); return; }
    setDaysRows(data || []);
  }
  async function toggleDay(day: string) {
    if (openDay === day) { setOpenDay(null); return; }
    setOpenDay(day);
    const { data, error } = await supabase.rpc('admin_recon_receipts', { p_day: day });
    if (error) { alert(error.message); return; }
    setDayReceipts(data || []);
  }

  const totals = useMemo(() => months.reduce((s, r) => ({
    receipts: s.receipts + Number(r.receipts), confirmed: s.confirmed + Number(r.confirmed), gmv: s.gmv + Number(r.gmv),
  }), { receipts: 0, confirmed: 0, gmv: 0 }), [months]);

  function exportCsv() {
    const head = 'month,receipts,confirmed,gmv\n';
    const body = months.map(r => `${r.month},${r.receipts},${r.confirmed},${r.gmv}`).join('\n');
    const total = `\nTOTAL,${totals.receipts},${totals.confirmed},${totals.gmv}`;
    const blob = new Blob([head + body + total], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'rooster-reconciliation.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  if (err) return <><h1 className="h1">Money Desk</h1><div className="card" style={{ padding: 24, color: 'var(--danger)' }}>Could not load: {err}</div></>;
  if (!m) return <><h1 className="h1">Money Desk</h1><Loading/></>;

  const pending = [
    ...(m.boost_pending || []).map((b: any) => ({ ...b, kind: 'boost', who: b.seller, what: (b.breed || 'listing') + ' boost', goKey: 'boosts' })),
    ...(m.feature_pending || []).map((f: any) => ({ ...f, kind: 'feature', who: f.name, what: 'profile feature', goKey: 'featured' })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const conv = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  const kpis = [
    { lab: 'Boost revenue', val: inr(m.boost_rev), sub: `${m.boost_activated}/${m.boost_total} activated (${conv(m.boost_activated, m.boost_total)}%)`, Icon: Rocket, accent: 'grad-blue' },
    { lab: 'Feature revenue', val: inr(m.feature_rev), sub: `${m.feature_activated}/${m.feature_total} activated (${conv(m.feature_activated, m.feature_total)}%)`, Icon: Star, accent: 'grad-amber' },
    { lab: 'Total revenue', val: inr(Number(m.boost_rev) + Number(m.feature_rev)), sub: `last ${days} days`, Icon: IndianRupee, accent: 'grad-green' },
    { lab: 'Waiting on UPI', val: pending.length, sub: pending.length ? `oldest ${daysWaiting(pending[0].at)}d` : 'queue clear', Icon: Hourglass, accent: 'grad-iris' },
  ];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="h1">Money Desk</h1>
          <p className="sub">Boost + feature income, pending UPI confirmations, and the receipts sheet you'll want at tax time.</p>
        </div>
        <div className="tabbar" style={{ margin: 0 }}>
          {RANGES.map(r => (
            <button key={r.days} className={days === r.days ? 'active' : ''} onClick={() => setDays(r.days)}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="kpis">
        {kpis.map(c => (
          <div className={`kpi ${c.accent}`} key={c.lab}>
            <div className="lab"><c.Icon size={14}/> {c.lab}</div>
            <div className="val">{c.val}</div>
            <div className="delta">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue over time — boost + feature stacked by day */}
      <div className="card">
        <div className="card-h"><h2><IndianRupee size={16}/> Revenue over time</h2></div>
        <div style={{ padding: '18px 12px 8px' }}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={m.series || []} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
              <CartesianGrid stroke="rgba(20,30,55,.08)" vertical={false}/>
              <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fill: '#646B7D', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24}/>
              <YAxis tick={{ fill: '#646B7D', fontSize: 11 }} tickLine={false} axisLine={false} width={44}/>
              <Tooltip contentStyle={tt} labelFormatter={fmtDay} cursor={{ fill: 'rgba(255,255,255,.04)' }}
                formatter={(v: any, name: any) => [inr(Number(v)), name === 'boost' ? 'Boosts' : 'Features']}/>
              <Bar dataKey="boost" stackId="a" fill="#5B8CFF"/>
              <Bar dataKey="feature" stackId="a" fill="#E9A23B" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid2">
        {/* Pending UPI confirmations, oldest first */}
        <div className="card">
          <div className="card-h"><h2><Hourglass size={16}/> Waiting on UPI confirmation</h2>
            {pending.length > 0 && <span className="badge b-warn">{pending.length}</span>}</div>
          {pending.length === 0 ? <Empty text="Nothing pending — every payment is confirmed."/> : (
            <table>
              <thead><tr><th>Who</th><th>What</th><th>Amount</th><th>Waiting</th><th></th></tr></thead>
              <tbody>
                {pending.map(p => {
                  const w = daysWaiting(p.at);
                  return (
                    <tr key={p.kind + p.id}>
                      <td style={{ fontWeight: 600 }}>{p.who || '—'}</td>
                      <td className="muted">{p.what}</td>
                      <td>{inr(p.amount)}</td>
                      <td><span className={'badge ' + (w >= 2 ? 'b-danger' : w >= 1 ? 'b-warn' : 'b-mut')}>{w === 0 ? 'today' : `${w}d`}</span></td>
                      <td className="right"><button className="btn ghost sm" onClick={() => go(p.goKey)}>Open</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Repeat buyers */}
        <div className="card">
          <div className="card-h"><h2><Users size={16}/> Repeat buyers</h2></div>
          {(m.repeat_buyers || []).length === 0 ? <Empty text="No repeat buyers yet — appears once a buyer confirms 2+ receipts."/> : (
            <table>
              <thead><tr><th>Buyer</th><th className="right">Purchases</th><th className="right">Total GMV</th></tr></thead>
              <tbody>
                {(m.repeat_buyers || []).map((b: any) => (
                  <tr key={b.id || b.name}>
                    <td style={{ fontWeight: 600 }}>{b.name || '—'}</td>
                    <td className="right">{b.n}</td>
                    <td className="right" style={{ color: 'var(--ok)', fontWeight: 600 }}>{inr(b.gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Reconciliation: months → days → receipts */}
      <div className="card">
        <div className="card-h"><h2><RefreshCcw size={16}/> Reconciliation — receipts by month</h2>
          <button className="btn ghost sm" onClick={exportCsv}><Download size={13}/> Export CSV</button></div>
        {months.length === 0 ? <Empty text="No receipts yet."/> : (
          <table>
            <thead><tr><th>Month</th><th className="right">Receipts</th><th className="right">Confirmed</th><th className="right">GMV (confirmed)</th></tr></thead>
            <tbody>
              {months.map(r => (
                <MonthRows key={r.month} r={r} open={openMonth === r.month} onToggle={() => toggleMonth(r.month)}
                  daysRows={daysRows} openDay={openDay} onToggleDay={toggleDay}
                  dayReceipts={dayReceipts} openReceipt={openReceipt}/>
              ))}
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--line)' }}>
                <td>Total (12 mo)</td>
                <td className="right">{totals.receipts}</td>
                <td className="right">{totals.confirmed}</td>
                <td className="right" style={{ color: 'var(--ok)' }}>{inr(totals.gmv)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function MonthRows({ r, open, onToggle, daysRows, openDay, onToggleDay, dayReceipts, openReceipt }: any) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td style={{ fontWeight: 600 }}>
          {open ? <ChevronDown size={13} style={{ verticalAlign: -2 }}/> : <ChevronRight size={13} style={{ verticalAlign: -2 }}/>} {fmtMonth(r.month)}
        </td>
        <td className="right">{r.receipts}</td>
        <td className="right">{r.confirmed}</td>
        <td className="right" style={{ fontWeight: 600 }}>{inr(Number(r.gmv))}</td>
      </tr>
      {open && daysRows.map((d: any) => (
        <MonthDay key={d.day} d={d} open={openDay === d.day} onToggle={() => onToggleDay(d.day)}
          receipts={dayReceipts} openReceipt={openReceipt}/>
      ))}
      {open && daysRows.length === 0 && <tr><td colSpan={4} className="empty" style={{ padding: 12 }}>No receipts this month.</td></tr>}
    </>
  );
}

function MonthDay({ d, open, onToggle, receipts, openReceipt }: any) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td style={{ paddingLeft: 34, color: 'var(--muted)' }}>
          {open ? <ChevronDown size={12} style={{ verticalAlign: -2 }}/> : <ChevronRight size={12} style={{ verticalAlign: -2 }}/>} {new Date(d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </td>
        <td className="right muted">{d.receipts}</td>
        <td className="right muted">{d.confirmed}</td>
        <td className="right muted">{inr(Number(d.gmv))}</td>
      </tr>
      {open && receipts.map((x: any) => (
        <tr key={x.id} onClick={() => openReceipt(x.id)} style={{ cursor: 'pointer' }}>
          <td style={{ paddingLeft: 54, fontSize: 12.5 }}>#{x.receipt_no} <span className="muted">· {x.buyer_name || '?'} ← {x.seller_name || '?'}</span></td>
          <td className="right" colSpan={2}><span className={'badge ' + (x.status === 'acknowledged' ? 'b-ok' : x.status === 'declined' ? 'b-danger' : 'b-mut')}>{x.status}</span></td>
          <td className="right" style={{ fontSize: 12.5 }}>{inr(Number(x.price))}</td>
        </tr>
      ))}
    </>
  );
}
