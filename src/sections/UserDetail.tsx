import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Modal } from '../ui';
import { ShieldCheck, Flag, Star, Store, ListChecks, IndianRupee, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
const day = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function UserDetail({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [d, setD] = useState<any | null>(null);
  useEffect(() => {
    // Distinguish a real load failure from a genuinely missing user, instead of
    // collapsing every error into "User not found."
    supabase.rpc('admin_user_overview', { p_user: userId }).then(({ data, error }) => setD(error ? { __error: error.message } : (data ?? {})));
  }, [userId]);

  const p = d?.profile;
  const stats = d ? [
    { lab: 'GMV', val: inr(d.gmv), Icon: IndianRupee, c: 'var(--ok)' },
    { lab: 'Sales', val: d.sales, Icon: ListChecks, c: 'var(--cta)' },
    { lab: 'Listings', val: `${d.listings_active}/${d.listings_total}`, Icon: ListChecks, c: 'var(--cta)' },
    { lab: 'Products', val: d.products_total, Icon: Store, c: 'var(--iris)' },
    { lab: 'Rating', val: d.rating_count ? `${d.rating_avg}★ (${d.rating_count})` : '—', Icon: Star, c: 'var(--warn)' },
    { lab: 'Followers', val: d.followers, Icon: Users, c: 'var(--iris)' },
    { lab: 'Reports against', val: d.reports_against, Icon: Flag, c: d.reports_against ? 'var(--danger)' : 'var(--muted)' },
    { lab: 'Purchases', val: d.purchases, Icon: IndianRupee, c: 'var(--cta)' },
  ] : [];

  return (
    <Modal title={p ? (p.full_name || 'User') : 'Loading…'} onClose={onClose}>
      {!d ? <div className="loading">Loading…</div> : d.__error ? <div className="empty">Could not load user: {d.__error}</div> : !p ? <div className="empty">User not found.</div> : (
        <>
          {/* header */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {p.avatar_url ? <img src={p.avatar_url} className="thumb" style={{ width: 56, height: 56, borderRadius: '50%' }} />
              : <div className="thumb" style={{ width: 56, height: 56, borderRadius: '50%' }} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{p.full_name || '—'}
                {p.aadhaar_verified && <span className="badge b-ok" style={{ marginLeft: 8 }}><ShieldCheck size={12} /> KYC</span>}
                {p.banned && <span className="badge b-danger" style={{ marginLeft: 6 }}>Banned</span>}
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {p.handle ? '@' + p.handle : ''} · {p.phone || 'no phone'} · {[p.district, p.state].filter(Boolean).join(', ') || '—'}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>Joined {new Date(p.created_at).toLocaleDateString('en-IN')}</div>
            </div>
          </div>

          {/* stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}>
            {stats.map(s => (
              <div key={s.lab} style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em', display: 'flex', gap: 5, alignItems: 'center' }}><s.Icon size={12} /> {s.lab}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginTop: 3, color: s.c }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* activity chart */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Last 30 days — listings &amp; sales</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={d.activity || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(20,30,55,.08)" vertical={false} />
                <XAxis dataKey="day" tickFormatter={day} tick={{ fill: '#646B7D', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={28} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(20,30,55,.14)', borderRadius: 8, fontSize: 12, color: '#1B2436' }} labelFormatter={day} />
                <Bar dataKey="listings" stackId="a" fill="#5B8CFF" />
                <Bar dataKey="sales" stackId="a" fill="#3FB67A" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* reports against */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
              <Flag size={13} style={{ verticalAlign: -2 }} /> Reports against ({d.reports_against})
            </div>
            {(d.recent_reports || []).length === 0 ? <div className="muted" style={{ fontSize: 12.5 }}>No reports.</div> : (
              <div style={{ display: 'grid', gap: 6 }}>
                {d.recent_reports.map((r: any, i: number) => (
                  <div key={i} style={{ background: 'var(--dangerbg)', border: '1px solid rgba(229,72,77,.2)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5 }}>
                    <b>{r.reason || 'report'}</b> <span className="muted">· {r.target_type} · {new Date(r.created_at).toLocaleDateString('en-IN')} · {r.status}</span>
                    {r.details && <div className="muted" style={{ marginTop: 2 }}>{r.details}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* recent reviews */}
          {(d.recent_reviews || []).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}><Star size={13} style={{ verticalAlign: -2 }} /> Recent reviews</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {d.recent_reviews.map((v: any, i: number) => (
                  <div key={i} style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5 }}>
                    <b style={{ color: 'var(--warn)' }}>{'★'.repeat(v.rating)}</b> {v.body && <span>{v.body}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
