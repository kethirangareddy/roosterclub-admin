import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { ListChecks, Search, Eye } from 'lucide-react';
import { Empty, Loading, loc, inr, timeAgo, useParamState, UserLink, LoadError } from '../ui';
import { useDetail, useOnChanged } from '../detail';
import { toast } from '../feedback';

type Filter = 'all' | 'live' | 'pending' | 'sold' | 'expired' | 'removed';
const FILTERS: { v: Filter; label: string }[] = [
  { v: 'all', label: 'All' }, { v: 'live', label: 'Live' }, { v: 'pending', label: 'Pending approval' },
  { v: 'sold', label: 'Sold' }, { v: 'expired', label: 'Expired' }, { v: 'removed', label: 'Removed' },
];

export default function Listings() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useParamState<Filter>('f', 'all');
  const { openListing } = useDetail();
  useOnChanged(() => load(true));

  // Only the newest request may fill the table — tapping Pending then Removed
  // on a slow network used to show Pending's rows under the Removed tab.
  const reqRef = useRef(0);
  const [loadErr, setLoadErr] = useState(false);
  // Background reloads reuse the search you ran, not half-typed text.
  const runQ = useRef('');
  async function load(quiet = false) {
    const my = ++reqRef.current;
    setLoading(true);
    const nowIso = new Date().toISOString();
    let query = supabase.from('listings')
      .select('id,user_id,breed,type,price,status,approval_status,created_at,expires_at,state,district,mandal,village,users!listings_user_id_fkey(full_name,handle)')
      .order('created_at', { ascending: false }).limit(200);
    if (fStatus === 'live') query = query.eq('status', 'active').eq('approval_status', 'approved').gt('expires_at', nowIso);
    else if (fStatus === 'pending') query = query.eq('approval_status', 'pending');
    else if (fStatus === 'sold') query = query.eq('status', 'sold');
    else if (fStatus === 'expired') query = query.eq('status', 'expired');
    else if (fStatus === 'removed') query = query.eq('status', 'removed');
    // Commas/brackets would break the filter syntax — treat them as spaces.
    if (!quiet) runQ.current = q;
    const term = runQ.current.trim().replace(/[,()*%]/g, ' ').trim();
    if (term) query = query.or(`breed.ilike.%${term}%,type.ilike.%${term}%`);
    const { data, error } = await query;
    if (my !== reqRef.current) return;
    setLoadErr(!!error); // a failed load must not read as "no listings"
    setRows(data || []); setLoading(false);
  }
  useEffect(() => { load(); }, [fStatus]);

  function liveLabel(r: any) {
    // Not approved yet (or rejected) — show that, not a green "active".
    if (r.status === 'active' && r.approval_status && r.approval_status !== 'approved') return r.approval_status;
    if (r.status === 'active' && r.expires_at && new Date(r.expires_at) <= new Date()) return 'expired';
    return r.status;
  }

  return (
    <>
      <h1 className="h1">Listings</h1>
      <p className="sub">Every listing on the marketplace — live, pending, sold, expired or removed. Tap a row to open the full 360.</p>
      <div className="card">
        <div className="card-h">
          <h2><ListChecks size={16} /> Listings ({rows.length >= 200 ? 'newest 200 — search to find older' : rows.length})</h2>
          <div className="toolbar">
            <input placeholder="Search breed / type…" value={q}
              onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} style={{ width: 220 }} />
            <button className="btn ghost sm" onClick={() => load()}><Search size={14} /> Search</button>
          </div>
        </div>
        <div className="tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0 12px' }}>
          {FILTERS.map(f => {
            const active = fStatus === f.v;
            return (
              <button key={f.v} onClick={() => setFStatus(f.v)}
                style={{
                  fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
                  padding: '6px 14px', borderRadius: 999,
                  border: '1px solid ' + (active ? '#BA7517' : 'var(--line-2)'),
                  background: active ? '#BA7517' : 'transparent',
                  color: active ? '#fff' : 'var(--muted)',
                }}>
                {f.label}
              </button>
            );
          })}
        </div>
        {loading ? <Loading /> : loadErr ? <LoadError what="listings" onRetry={load} /> : rows.length === 0 ? <Empty text="No listings match this filter." /> : (
          <table>
            <thead><tr><th>Breed / Type</th><th>Seller</th><th>Price</th><th>Location</th><th>Status</th><th>Approval</th><th>Posted</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => {
                const st = liveLabel(r);
                return (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openListing(r.id)}>
                    <td><b>{r.breed || '—'}</b><div className="muted">{r.type}</div></td>
                    {/* the row opens the listing; the seller link stops propagation and opens the user instead */}
                    <td><UserLink id={r.user_id}>{r.users?.full_name || (r.users?.handle ? '@' + r.users.handle : 'View seller')}</UserLink></td>
                    <td>{inr(r.price)}</td>
                    <td className="muted">{loc(r)}</td>
                    <td><span className={'badge ' + (st === 'active' ? 'b-ok' : st === 'sold' ? 'b-info' : st === 'expired' ? 'b-warn' : 'b-mut')}>{st}</span></td>
                    <td><span className={'badge ' + (r.approval_status === 'approved' ? 'b-ok' : r.approval_status === 'rejected' ? 'b-danger' : 'b-warn')}>{r.approval_status}</span></td>
                    <td className="muted">{timeAgo(r.created_at)}</td>
                    <td onClick={e => e.stopPropagation()}><button className="btn ghost sm" onClick={() => openListing(r.id)}><Eye size={13} /> View</button></td>
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
