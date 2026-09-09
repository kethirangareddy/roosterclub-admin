import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { Loading } from '../ui';
import {
  IndianRupee, TrendingUp, Users, ListChecks, Eye, MessageSquare, Receipt, Filter, MapPin, ChevronDown, ChevronRight,
  Repeat, Clock,
} from 'lucide-react';
import { useDetail } from '../detail';
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
type Region = { state: string; district: string; n: number };

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDay = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function Overview() {
  const [days, setDays] = useState(30);
  const [m, setM] = useState<Metrics | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [openState, setOpenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    const to = new Date().toISOString();
    const from = new Date(Date.now() - days * 864e5).toISOString();
    (async () => {
      const [om, fn, gs, ts, rg] = await Promise.all([
        supabase.rpc('admin_overview_metrics', { p_from: from, p_to: to }),
        supabase.rpc('admin_funnel', { p_from: from, p_to: to }),
        supabase.rpc('admin_growth_series', { p_days: days }),
        supabase.rpc('admin_top_sellers', { p_from: from, p_to: to, p_limit: 8 }),
        supabase.rpc('admin_users_by_region'),
      ]);
      if (!alive) return;
      // Surface a real error instead of spinning forever when an RPC fails.
      const e = om.error || fn.error || gs.error || ts.error || rg.error;
      if (e) { setErr(e.message); setLoading(false); return; }
      setM((om.data as Metrics) ?? null);
      setFunnel((fn.data as Funnel) ?? null);
      setSeries((gs.data as SeriesRow[]) ?? []);
      setSellers((ts.data as Seller[]) ?? []);
      setRegions((rg.data as Region[]) ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [days]);

  const funnelData = useMemo(() => {
    if (!funnel) return [];
    return [
      { stage: 'Views', v: funnel.views, c: '#BA7517' },
      { stage: 'Chats', v: funnel.chats, c: '#D9973F' },
      { stage: 'Receipts', v: funnel.issued, c: '#7B3F00' },
      { stage: 'Confirmed', v: funnel.acknowledged, c: '#2E7D32' },
    ];
  }, [funnel]);

  const conv = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  // Users grouped per state (districts nested), largest states first.
  const stateGroups = useMemo(() => {
    const map = new Map<string, { state: string; total: number; districts: { district: string; n: number }[] }>();
    for (const r of regions) {
      const g = map.get(r.state) ?? { state: r.state, total: 0, districts: [] };
      g.total += Number(r.n);
      g.districts.push({ district: r.district, n: Number(r.n) });
      map.set(r.state, g);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [regions]);
  const regionTotal = useMemo(() => stateGroups.reduce((s, g) => s + g.total, 0), [stateGroups]);

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
  if (loading) return <Loading />;
  if (!m || !funnel) return <div className="card" style={{ padding: 24 }}>No analytics data yet.</div>;

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
                  <stop offset="0%" stopColor="#2E7D32" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#2E7D32" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(44,24,16,.09)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fill: '#8a7458', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fill: '#8a7458', fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => v >= 1000 ? (v / 1000) + 'k' : v} />
              <Tooltip contentStyle={tt} labelFormatter={fmtDay} formatter={(v: any) => [inr(v as number), 'GMV']} />
              <Area type="monotone" dataKey="gmv" stroke="#2E7D32" strokeWidth={2} fill="url(#gGmv)" />
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
                <CartesianGrid stroke="rgba(44,24,16,.09)" vertical={false} />
                <XAxis dataKey="stage" tick={{ fill: '#a8977e', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#8a7458', fontSize: 11 }} tickLine={false} axisLine={false} width={38} />
                <Tooltip contentStyle={tt} cursor={{ fill: 'rgba(186,117,23,.08)' }} />
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
                <CartesianGrid stroke="rgba(44,24,16,.09)" vertical={false} />
                <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fill: '#8a7458', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fill: '#8a7458', fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={tt} labelFormatter={fmtDay} cursor={{ fill: 'rgba(186,117,23,.08)' }} />
                <Bar dataKey="listings" stackId="a" fill="#BA7517" radius={[0, 0, 0, 0]} />
                <Bar dataKey="users" stackId="a" fill="#7B3F00" radius={[4, 4, 0, 0]} />
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

      {/* Users by state / district */}
      <div className="card">
        <div className="card-h"><h2><MapPin size={16} /> Users by region ({regionTotal})</h2></div>
        <table>
          <thead><tr><th>State</th><th className="right">Users</th><th className="right">Share</th></tr></thead>
          <tbody>
            {stateGroups.map(g => (
              <FragmentRows key={g.state} g={g} total={regionTotal}
                open={openState === g.state}
                onToggle={() => setOpenState(openState === g.state ? null : g.state)} />
            ))}
            {stateGroups.length === 0 && <tr><td colSpan={3} className="empty">No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// One state row + its expandable district rows. Kept outside the main return for readability.
function FragmentRows({ g, total, open, onToggle }: {
  g: { state: string; total: number; districts: { district: string; n: number }[] };
  total: number; open: boolean; onToggle: () => void;
}) {
  const pct = total > 0 ? Math.round((g.total / total) * 100) : 0;
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td style={{ fontWeight: 600 }}>
          {open ? <ChevronDown size={13} style={{ verticalAlign: -2 }} /> : <ChevronRight size={13} style={{ verticalAlign: -2 }} />} {g.state}
          <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> · {g.districts.length} district{g.districts.length === 1 ? '' : 's'}</span>
        </td>
        <td className="right" style={{ fontWeight: 600 }}>{g.total}</td>
        <td className="right">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 70, height: 6, borderRadius: 3, background: 'rgba(44,24,16,.10)', overflow: 'hidden', display: 'inline-block' }}>
              <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: '#BA7517' }} />
            </span>
            <span style={{ color: 'var(--muted)', fontSize: 12, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
          </span>
        </td>
      </tr>
      {open && g.districts.map(d => (
        <tr key={d.district}>
          <td style={{ paddingLeft: 34, color: 'var(--muted)' }}>{d.district}</td>
          <td className="right">{d.n}</td>
          <td className="right" style={{ color: 'var(--muted)', fontSize: 12 }}>{g.total > 0 ? Math.round((d.n / g.total) * 100) : 0}%</td>
        </tr>
      ))}
    </>
  );
}

const tt = {
  background: '#FFFFFF', border: '1px solid rgba(44,24,16,.14)', borderRadius: 10,
  color: '#2C1810', fontSize: 12, boxShadow: '0 8px 24px rgba(44,24,16,.14)',
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
   COHORTS — the question a marketing push has to answer: did the people who
   installed come BACK, and did they do anything? Signups alone can't tell you.
   ───────────────────────────────────────────────────────────────────────────── */
type Cohort = { cohort: string; signups: number; d1_back: number; d7_back: number; posted: number; chatted: number; dealt: number };

function heat(p: number) {
  return { background: `rgba(46,125,50,${0.06 + 0.5 * (p / 100)})`, fontWeight: p >= 40 ? 600 : 400 };
}

function Cohorts() {
  const [rows, setRows] = useState<Cohort[]>([]);
  const [days, setDays] = useState(21);
  const [source, setSource] = useState<string>('');
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    (async () => {
      const [co, ac] = await Promise.all([
        supabase.rpc('admin_cohorts', { p_days: days, p_source: source || null }),
        supabase.rpc('admin_acquisition_counts'),
      ]);
      if (!alive) return;
      if (co.error) { setErr(co.error.message); setLoading(false); return; }
      setRows((co.data as Cohort[]) || []);
      setSources(((ac.data as any[]) || []).map(r => r.source).filter(Boolean));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [days, source]);

  const tot = rows.reduce((s, r) => ({
    signups: s.signups + Number(r.signups), d1: s.d1 + Number(r.d1_back),
    posted: s.posted + Number(r.posted), chatted: s.chatted + Number(r.chatted),
  }), { signups: 0, d1: 0, posted: 0, chatted: 0 });
  const p = (a: number, b: number) => (b > 0 ? Math.round(a / b * 100) : 0);

  if (err) return <div className="card" style={{ padding: 24, color: 'var(--danger)' }}>Could not load cohorts: {err}</div>;

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p className="sub" style={{ margin: 0 }}>Each row is one day's signups. Did they come back, and did they do anything?</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={source} onChange={e => setSource(e.target.value)} title="Filter by how they heard about us">
            <option value="">All sources</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="tabbar" style={{ margin: 0 }}>
            {[7, 21, 60].map(d => (
              <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>{d}d</button>
            ))}
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi grad-iris"><div className="lab"><Users size={14} /> Signups</div>
          <div className="val">{tot.signups}</div><div className="delta">last {days} days</div></div>
        <div className="kpi grad-green"><div className="lab"><Repeat size={14} /> Came back D1</div>
          <div className="val">{p(tot.d1, tot.signups)}%</div><div className="delta">{tot.d1} of {tot.signups}</div></div>
        <div className="kpi grad-amber"><div className="lab"><ListChecks size={14} /> Posted a listing</div>
          <div className="val">{p(tot.posted, tot.signups)}%</div><div className="delta">{tot.posted} sellers</div></div>
        <div className="kpi grad-blue"><div className="lab"><MessageSquare size={14} /> Started a chat</div>
          <div className="val">{p(tot.chatted, tot.signups)}%</div><div className="delta">{tot.chatted} users</div></div>
      </div>

      <div className="card">
        <div className="card-h"><h2><Repeat size={16} /> Retention &amp; activation by signup day</h2></div>
        {loading ? <Loading /> : rows.length === 0 ? <div className="empty">No signups in this range.</div> : (
          <table>
            <thead><tr>
              <th>Signup day</th><th className="right">Signups</th>
              <th className="right">Back D1</th><th className="right">Back in 7d</th>
              <th className="right">Posted</th><th className="right">Chatted</th><th className="right">Dealt</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.cohort}>
                  <td style={{ fontWeight: 600 }}>{new Date(r.cohort).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td className="right">{r.signups}</td>
                  <td className="right" style={heat(p(r.d1_back, r.signups))}>{p(r.d1_back, r.signups)}%</td>
                  <td className="right" style={heat(p(r.d7_back, r.signups))}>{p(r.d7_back, r.signups)}%</td>
                  <td className="right" style={heat(p(r.posted, r.signups))}>{p(r.posted, r.signups)}%</td>
                  <td className="right" style={heat(p(r.chatted, r.signups))}>{p(r.chatted, r.signups)}%</td>
                  <td className="right">{r.dealt || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding: '0 18px 12px', fontSize: 12 }} className="muted">
          Today's row always shows 0% back — the day isn't over. Read from yesterday up.
          The daily actives chart lives on the Command Center.
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LIQUIDITY — a marketplace dies where there are buyers and nothing to buy.
   Districts with users and views but zero active listings, worst first.
   ───────────────────────────────────────────────────────────────────────────── */
type Liq = { state: string; district: string; users: number; active_listings: number; views: number; chats: number; users_per_listing: number };

function Liquidity() {
  const [rows, setRows] = useState<Liq[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyGaps, setOnlyGaps] = useState(true);

  useEffect(() => {
    supabase.rpc('admin_liquidity', { p_days: 30 }).then(({ data, error }) => {
      if (error) alert('Could not load liquidity: ' + error.message);
      setRows((data as Liq[]) || []); setLoading(false);
    });
  }, []);

  const shown = onlyGaps ? rows.filter(r => Number(r.active_listings) === 0 && Number(r.users) > 0) : rows;
  const gapUsers = rows.filter(r => Number(r.active_listings) === 0).reduce((s, r) => s + Number(r.users), 0);

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p className="sub" style={{ margin: 0 }}>Districts ranked by demand with no supply. These are the places to recruit sellers.</p>
        <div className="tabbar" style={{ margin: 0 }}>
          <button className={onlyGaps ? 'active' : ''} onClick={() => setOnlyGaps(true)}>Supply gaps</button>
          <button className={!onlyGaps ? 'active' : ''} onClick={() => setOnlyGaps(false)}>All districts</button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi grad-amber"><div className="lab"><MapPin size={14} /> Users with no local supply</div>
          <div className="val">{gapUsers}</div><div className="delta">{rows.filter(r => Number(r.active_listings) === 0).length} districts</div></div>
        <div className="kpi grad-green"><div className="lab"><ListChecks size={14} /> Districts with listings</div>
          <div className="val">{rows.filter(r => Number(r.active_listings) > 0).length}</div><div className="delta">of {rows.length} with users</div></div>
      </div>

      <div className="card">
        <div className="card-h"><h2><MapPin size={16} /> Supply vs demand by district</h2>
          <span className="badge b-mut">{shown.length}</span></div>
        {loading ? <Loading /> : shown.length === 0 ? <div className="empty">No districts match.</div> : (
          <table>
            <thead><tr>
              <th>District</th><th>State</th><th className="right">Users</th>
              <th className="right">Views 30d</th><th className="right">Chats 30d</th>
              <th className="right">Active listings</th><th className="right">Users / listing</th>
            </tr></thead>
            <tbody>
              {shown.slice(0, 60).map(r => {
                const gap = Number(r.active_listings) === 0;
                return (
                  <tr key={r.state + '|' + r.district}>
                    <td style={{ fontWeight: 600 }}>{r.district}</td>
                    <td className="muted">{r.state}</td>
                    <td className="right">{r.users}</td>
                    <td className="right">{r.views}</td>
                    <td className="right">{r.chats}</td>
                    <td className="right">
                      {gap ? <span className="badge b-danger">none</span> : r.active_listings}
                    </td>
                    <td className="right" style={{ fontWeight: gap ? 600 : 400, color: gap ? 'var(--danger)' : undefined }}>
                      {gap ? '∞' : r.users_per_listing}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div style={{ padding: '0 18px 12px', fontSize: 12 }} className="muted">
          A district with users, views and zero listings is a district where buyers open the app and find nothing.
          Announcements can target exactly these — pick the state/district there.
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   FUNNEL HEALTH — the Overview tab shows WHERE the funnel narrows. This shows
   WHO to go and talk to about it: the listings nobody messages, the sellers who
   never answer.
   ───────────────────────────────────────────────────────────────────────────── */
function FunnelHealth() {
  const [d, setD] = useState<any | null>(null);
  const [days, setDays] = useState(30);
  const [err, setErr] = useState<string | null>(null);
  const { openUser, openListing } = useDetail();

  useEffect(() => {
    let alive = true;
    setD(null);
    supabase.rpc('admin_funnel_health', { p_days: days }).then(({ data, error }) => {
      if (!alive) return;
      if (error) { setErr(error.message); return; }
      setD(data);
    });
    return () => { alive = false; };
  }, [days]);

  if (err) return <div className="card" style={{ padding: 24, color: 'var(--danger)' }}>Could not load: {err}</div>;
  if (!d) return <Loading />;
  const p = (a: number, b: number) => (b > 0 ? Math.round(a / b * 100) : 0);

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p className="sub" style={{ margin: 0 }}>Where deals stall, and who is stalling them.</p>
        <div className="tabbar" style={{ margin: 0 }}>
          {[7, 30, 90].map(n => <button key={n} className={days === n ? 'active' : ''} onClick={() => setDays(n)}>{n}d</button>)}
        </div>
      </div>

      <div className="kpis">
        <div className="kpi grad-blue"><div className="lab"><Eye size={14} /> Views</div>
          <div className="val">{d.views}</div><div className="delta">{d.listings_viewed_no_chat} listings got views but no chat</div></div>
        <div className="kpi grad-amber"><div className="lab"><MessageSquare size={14} /> Chats</div>
          <div className="val">{d.chats}</div><div className="delta">{p(d.chats, d.views)}% of views</div></div>
        <div className="kpi grad-iris"><div className="lab"><Clock size={14} /> Median first reply</div>
          <div className="val">{d.median_first_reply_min != null ? d.median_first_reply_min + 'm' : '—'}</div>
          <div className="delta">seller answering a buyer</div></div>
        <div className="kpi grad-green"><div className="lab"><Receipt size={14} /> Receipts issued</div>
          <div className="val">{d.issued}</div><div className="delta">{d.acked} confirmed</div></div>
      </div>

      <div className="card" style={{ borderColor: 'rgba(192,57,43,.3)' }}>
        <div className="card-h"><h2><MessageSquare size={16} /> Chats the seller never answered</h2>
          <span className="badge b-danger">{d.chats_no_seller_reply} of {d.chats}</span></div>
        <div style={{ padding: '0 18px 14px' }} className="muted">
          {p(d.chats_no_seller_reply, d.chats)}% of buyers who reached out got silence. That is the single
          biggest leak between a view and a sale.
        </div>
        {(d.slow_sellers || []).length > 0 && (
          <table>
            <thead><tr><th>Seller</th><th className="right">Ignored chats</th><th></th></tr></thead>
            <tbody>
              {d.slow_sellers.map((s: any) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td className="right"><span className="badge b-warn">{s.ignored_chats}</span></td>
                  <td className="right"><button className="btn ghost sm" onClick={() => openUser(s.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-h"><h2><Eye size={16} /> Most-viewed listings with zero chats</h2></div>
        {(d.stalled || []).length === 0 ? <div className="empty">Every viewed listing got at least one chat.</div> : (
          <table>
            <thead><tr><th>Breed</th><th>District</th><th className="right">Price</th><th className="right">Views</th><th></th></tr></thead>
            <tbody>
              {d.stalled.map((l: any) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{l.breed || '—'}</td>
                  <td className="muted">{l.district || '—'}</td>
                  <td className="right">{inr(l.price)}</td>
                  <td className="right">{l.views}</td>
                  <td className="right"><button className="btn ghost sm" onClick={() => openListing(l.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding: '0 18px 12px', fontSize: 12 }} className="muted">
          Lots of views and no messages usually means the price is wrong, the photos are bad, or the
          contact route is broken. Worth opening a few by hand.
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SOURCES — was its own top-level "Acquisition" nav item showing one table.
   It belongs next to the cohorts it explains.
   ───────────────────────────────────────────────────────────────────────────── */
function Sources() {
  const [rows, setRows] = useState<{ source: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc('admin_acquisition_counts').then(({ data, error }) => {
      if (error) alert('Could not load acquisition data: ' + error.message);
      setRows(((data as any[]) || []).map(r => ({ source: r.source, count: Number(r.n) })));
      setLoading(false);
    });
  }, []);

  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <>
      <p className="sub">Self-reported “How did you hear about us?” at signup. Cross-check any spike here against the Cohorts tab — installs are not users.</p>
      <div className="card">
        <div className="card-h"><h2><TrendingUp size={16} /> Sign-ups by source ({total})</h2></div>
        {loading ? <Loading /> : rows.length === 0 ? <div className="empty">No sign-ups yet.</div> : (
          <table>
            <thead><tr><th>Source</th><th className="right">Users</th><th className="right">Share</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const pc = total ? Math.round(r.count / total * 100) : 0;
                return (
                  <tr key={r.source}>
                    <td style={{ fontWeight: 600 }}>{r.source}</td>
                    <td className="right">{r.count}</td>
                    <td className="right">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 90, height: 6, borderRadius: 3, background: 'rgba(44,24,16,.10)', overflow: 'hidden', display: 'inline-block' }}>
                          <span style={{ display: 'block', width: `${pc}%`, height: '100%', background: '#BA7517' }} />
                        </span>
                        <span className="muted" style={{ minWidth: 32, textAlign: 'right' }}>{pc}%</span>
                      </span>
                    </td>
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

/* ─── Tab shell. ?tab= keeps every view bookmarkable, same as ?view=. ─── */
const TABS = [
  { key: 'overview',  label: 'Overview',      C: Overview },
  { key: 'cohorts',   label: 'Retention',     C: Cohorts },
  { key: 'funnel',    label: 'Funnel health', C: FunnelHealth },
  { key: 'liquidity', label: 'Supply gaps',   C: Liquidity },
  { key: 'sources',   label: 'Sources',       C: Sources },
];

export default function Analytics() {
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(location.search).get('tab');
    return TABS.some(x => x.key === t) ? t! : 'overview';
  });
  function pick(k: string) {
    setTab(k);
    const u = new URL(location.href);
    u.searchParams.set('view', 'analytics');
    if (k === 'overview') u.searchParams.delete('tab'); else u.searchParams.set('tab', k);
    history.replaceState(null, '', u);
  }
  const Active = (TABS.find(t => t.key === tab) || TABS[0]).C;
  return (
    <>
      <h1 className="h1">Analytics</h1>
      <div className="tabbar">
        {TABS.map(t => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => pick(t.key)}>{t.label}</button>
        ))}
      </div>
      <Active />
    </>
  );
}
