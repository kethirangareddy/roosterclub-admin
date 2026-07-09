import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Modal } from '../ui';
import { ShieldCheck, Flag, Star, Store, ListChecks, IndianRupee, Users, BellRing, Send } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
const day = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function UserDetail({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [d, setD] = useState<any | null>(null);
  const [kyc, setKyc] = useState<any | null>(null);
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);
  const [compose, setCompose] = useState(false);
  const [pTitle, setPTitle] = useState('');
  const [pBody, setPBody] = useState('');
  const [pushing, setPushing] = useState(false);

  async function sendPush() {
    if (!pTitle.trim() || !pBody.trim()) { alert('Title and message are required.'); return; }
    setPushing(true);
    const { data, error } = await supabase.rpc('admin_notify_user', { p_user: userId, p_title: pTitle.trim(), p_body: pBody.trim() });
    setPushing(false);
    if (error) { alert('Could not send: ' + error.message); return; }
    alert(`Delivered to ${data ?? 0} device(s) — it's also in their in-app notifications.`);
    setCompose(false); setPTitle(''); setPBody('');
  }
  useEffect(() => {
    // Distinguish a real load failure from a genuinely missing user, instead of
    // collapsing every error into "User not found."
    supabase.rpc('admin_user_overview', { p_user: userId }).then(({ data, error }) => setD(error ? { __error: error.message } : (data ?? {})));
  }, [userId]);
  useEffect(() => {
    // Pull the user's latest KYC submission + signed photo URLs (1h) so the admin can
    // eyeball the Aadhaar/selfie right here without hopping to the Verifications tab.
    (async () => {
      setKyc(null);
      const { data } = await supabase.from('kyc_submissions')
        .select('aadhaar_path,selfie_path,status,created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!data) { setKyc({ none: true }); return; }
      const out: any = { status: data.status };
      if (data.aadhaar_path) { const a = await supabase.storage.from('kyc').createSignedUrl(data.aadhaar_path, 3600); out.a_url = a.data?.signedUrl; }
      if (data.selfie_path) { const s = await supabase.storage.from('kyc').createSignedUrl(data.selfie_path, 3600); out.s_url = s.data?.signedUrl; }
      setKyc(out);
    })();
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
            <button className="btn ghost sm" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => setCompose(c => !c)}>
              <BellRing size={13} /> Message
            </button>
          </div>

          {/* one-user push — "your listing was rejected because…" */}
          {compose && (
            <div style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
              <input value={pTitle} maxLength={80} placeholder="Title — e.g. About your listing"
                onChange={e => setPTitle(e.target.value)} />
              <textarea rows={2} value={pBody} maxLength={240} style={{ resize: 'vertical' }}
                placeholder="Message — lands as a push + in their notifications tab."
                onChange={e => setPBody(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn ghost sm" onClick={() => setCompose(false)}>Cancel</button>
                <button className="btn sm" disabled={pushing} onClick={sendPush}><Send size={12} /> {pushing ? 'Sending…' : 'Send push'}</button>
              </div>
            </div>
          )}

          {/* KYC photos */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
              <ShieldCheck size={13} style={{ verticalAlign: -2 }} /> KYC photos{kyc?.status ? <span className="muted"> · {kyc.status}</span> : ''}
            </div>
            {!kyc ? <div className="muted" style={{ fontSize: 12.5 }}>Loading…</div>
              : kyc.none ? <div className="muted" style={{ fontSize: 12.5 }}>No KYC submitted.</div> : (
                <div style={{ display: 'flex', gap: 10 }}>
                  {kyc.a_url
                    ? <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Aadhaar</div>
                        <img src={kyc.a_url} onClick={() => setZoom({ url: kyc.a_url, label: 'Aadhaar' })}
                          style={{ height: 70, borderRadius: 6, cursor: 'zoom-in', border: '1px solid var(--line)' }} /></div>
                    : null}
                  {kyc.s_url
                    ? <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Selfie</div>
                        <img src={kyc.s_url} onClick={() => setZoom({ url: kyc.s_url, label: 'Selfie' })}
                          style={{ height: 70, borderRadius: 6, cursor: 'zoom-in', border: '1px solid var(--line)' }} /></div>
                    : null}
                </div>
              )}
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

          {zoom && (
            <div onClick={() => setZoom(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 2000, cursor: 'zoom-out' }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{zoom.label} — click anywhere to close</div>
              <img src={zoom.url} onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '92vw', maxHeight: '82vh', borderRadius: 8, boxShadow: '0 12px 48px rgba(0,0,0,0.6)', cursor: 'default' }} />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
