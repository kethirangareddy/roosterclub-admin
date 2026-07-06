import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { Loading } from '../ui';
import {
  IndianRupee, TrendingUp, Users, ListChecks, Eye, MessageSquare, Receipt, Filter,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

type Metrics = {
  gmv: number; sales: number; avg_price: number; new_users: number; new_listings: number;
  active_listings: number; total_users: number; feature_paid: number; views: number; chats: number;
};
type Funnel = { views: number; chats: number; issued: number; acknowledged: number };
type SeriesRow = { day: string; users: number; listings: number; sales: number; gmv: number };
type Seller = { seller_id: string; name: string; sales: number; gmv: number };

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDay = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [m, setM] = useState<Metrics | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    const to = new Date().toISOString();
    const from = new Date(Date.now() - days * 864e5).toISOString();
    (async () => {
      const [om, fn, gs, ts] = await Promise.all([
        supabase.rpc('admin_overview_metrics', { p_from: from, p_to: to }),
        supabase.rpc('admin_funnel', { p_from: from, p_to: to }),
        supabase.rpc('admin_growth_series', { p_days: days }),
        supabase.rpc('admin_top_sellers', { p_from: from, p_to: to, p_limit: 8 }),
      ]);
      if (!alive) return;
      // Surface a real error instead of spinning forever when an RPC fails.
      const e = om.error || fn.error || gs.error || ts.error;
      if (e) { setErr(e.message); setLoading(false); return; }
      setM((om.data as Metrics) ?? null);
      setFunnel((fn.data as Funnel) ?? null);
      setSeries((gs.data as SeriesRow[]) ?? []);
      setSellers((ts.data as Seller[]) ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [days]);

  const funnelData = useMemo(() => {
    if (!funnel) return [];
    return [
      { stage: 'Views', v: funnel.views, c: '#5B8CFF' },
      { stage: 'Chats', v: funnel.chats, c: '#6FA0FF' },
      { stage: 'Receipts', v: funnel.issued, c: '#8B7CFF' },
      { stage: 'Confirmed', v: funnel.acknowledged, c: '#3FB67A' },
    ];
  }, [funnel]);

  const conv = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  function exportCsv() {
    const head = 'date,new_users,new_listings,sales,gmv\n';
    const body = series.map(r => `${r.day},${r.users},${r.listings},${r.sales},${r.gmv}`).join('\n');
    const blob = new Blob([head + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rooster-analytics-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url); // free the blob instead of leaking it each export
  }

  if (err) return <div className="card" style={{ padding: 24, color: '#c0392b' }}>Could not load analytics: {err}</div>;
  if (loading || !m || !funnel) return <Loading />;

  const kpis = [
    { lab: 'GMV (sales value)', val: inr(m.gmv), sub: `${m.sales} sales`, Icon: IndianRupee, accent: 'grad-green' },
    { lab: 'Avg sale price', val: inr(m.avg_price), sub: 'per receipt', Icon: TrendingUp, accent: 'grad-blue' },
    { lab: 'New users', val: m.new_users, sub: `${m.total_users} total`, Icon: Users, accent: 'grad-iris' },
    { lab: 'New listings', val: m.new_listings, sub: `${m.active_listings} active`, Icon: ListChecks, accent: 'grad-amber' },
    { lab: 'Listing views', val: m.views, sub: 'in range', Icon: Eye, accent: 'grad-blue' },
    { lab: 'Chats started', val: m.chats, sub: 'buyer↔seller', Icon: MessageSquare, accent: 'grad-iris' },
  ];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="h1">Analytics</h1>
          <p className="sub">Marketplace performance · last {days} days</p>
        </div>
        <div className="toolbar">
          <div className="tabbar" style={{ margin: 0 }}>
            {RANGES.map(r => (
              <button key={r.days} className={days === r.days ? 'active' : ''} onClick={() => setDays(r.days)}>{r.label}</button>
            ))}
          </div>
          <button className="btn ghost sm" onClick={exportCsv}><Filter size={13} style={{ verticalAlign: -2 }} /> Export CSV</button>
        </div>
      </div>

      {/* KPI tiles with colored accents */}
      <div className="kpis">
        {kpis.map(c => (
          <div className={`kpi ${c.accent}`} key={c.lab}>
            <div className="lab"><c.Icon size={14} /> {c.lab}</div>
            <div className="val">{c.val}</div>
            <div className="delta">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* GMV + growth area chart */}
      <div className="card">
        <div className="card-h"><h2><IndianRupee size={16} /> Sales value (GMV) over time</h2></div>
        <div style={{ padding: '18px 12px 8px' }}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={series} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="gGmv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3FB67A" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#3FB67A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(20,30,55,.08)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fill: '#646B7D', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fill: '#646B7D', fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => v >= 1000 ? (v / 1000) + 'k' : v} />
              <Tooltip contentStyle={tt} labelFormatter={fmtDay} formatter={(v: any) => [inr(v as number), 'GMV']} />
              <Area type="monotone" dataKey="gmv" stroke="#3FB67A" strokeWidth={2} fill="url(#gGmv)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid2">
        {/* Funnel */}
        <div className="card">
          <div className="card-h"><h2><Receipt size={16} /> Conversion funnel</h2></div>
          <div style={{ padding: '18px 12px 6px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelData} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
                <CartesianGrid stroke="rgba(20,30,55,.08)" vertical={false} />
                <XAxis dataKey="stage" tick={{ fill: '#9AA1B2', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#646B7D', fontSize: 11 }} tickLine={false} axisLine={false} width={38} />
                <Tooltip contentStyle={tt} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                  {funnelData.map((d, i) => <Cell key={i} fill={d.c} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ padding: '0 18px 16px', display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 12 }}>
            <span>View→Chat <b style={{ color: 'var(--ink)' }}>{conv(funnel.chats, funnel.views)}%</b></span>
            <span>Chat→Receipt <b style={{ color: 'var(--ink)' }}>{conv(funnel.issued, funnel.chats)}%</b></span>
            <span>Receipt→Confirmed <b style={{ color: 'var(--ink)' }}>{conv(funnel.acknowledged, funnel.issued)}%</b></span>
          </div>
        </div>

        {/* New users + listings bars */}
        <div className="card">
          <div className="card-h"><h2><TrendingUp size={16} /> Growth (users &amp; listings)</h2></div>
          <div style={{ padding: '18px 12px 14px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={series} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
                <CartesianGrid stroke="rgba(20,30,55,.08)" vertical={false} />
                <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fill: '#646B7D', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fill: '#646B7D', fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={tt} labelFormatter={fmtDay} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar dataKey="listings" stackId="a" fill="#5B8CFF" radius={[0, 0, 0, 0]} />
                <Bar dataKey="users" stackId="a" fill="#8B7CFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top sellers */}
      <div className="card">
        <div className="card-h"><h2><Users size={16} /> Top sellers by GMV</h2></div>
        <table>
          <thead><tr><th>Seller</th><th className="right">Sales</th><th className="right">GMV</th></tr></thead>
          <tbody>
            {sellers.map(s => (
              <tr key={s.seller_id}><td style={{ fontWeight: 600 }}>{s.name}</td>
                <td className="right">{s.sales}</td>
                <td className="right" style={{ color: 'var(--ok)', fontWeight: 600 }}>{inr(s.gmv)}</td></tr>
            ))}
            {sellers.length === 0 && <tr><td colSpan={3} className="empty">No sales in this range yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

const tt = {
  background: '#FFFFFF', border: '1px solid rgba(20,30,55,.14)', borderRadius: 10,
  color: '#1B2436', fontSize: 12, boxShadow: '0 8px 24px rgba(20,30,55,.14)',
} as const;
