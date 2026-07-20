import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { ListChecks, Search, Eye } from 'lucide-react';
import { Empty, Loading, loc, inr, timeAgo, useParamState } from '../ui';
import Listing360 from './Listing360';

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
  const [open360, setOpen360] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const nowIso = new Date().toISOString();
    let query = supabase.from('listings')
      .select('id,user_id,breed,type,price,status,approval_status,created_at,expires_at,state,district,mandal,village,users(full_name,handle)')
      .order('created_at', { ascending: false }).limit(200);
    if (fStatus === 'live') query = query.eq('status', 'active').gt('expires_at', nowIso);
    else if (fStatus === 'pending') query = query.eq('approval_status', 'pending');
    else if (fStatus === 'sold') query = query.eq('status', 'sold');
    else if (fStatus === 'expired') query = query.eq('status', 'expired');
    else if (fStatus === 'removed') query = query.eq('status', 'removed');
    if (q.trim()) query = query.or(`breed.ilike.%${q.trim()}%,type.ilike.%${q.trim()}%`);
    const { data, error } = await query;
    if (error) alert('Could not load listings: ' + error.message);
    setRows(data || []); setLoading(false);
  }
  useEffect(() => { load(); }, [fStatus]);

  function liveLabel(r: any) {
    if (r.status === 'active' && r.expires_at && new Date(r.expires_at) <= new Date()) return 'expired';
    return r.status;
  }

  return (
    <>
      <h1 className="h1">Listings</h1>
      <p className="sub">Every listing on the marketplace — live, pending, sold, expired or removed. Tap a row to open the full 360.</p>
      <div className="card">
        <div className="card-h">
          <h2><ListChecks size={16} /> Listings ({rows.length})</h2>
          <div className="toolbar">
            <input placeholder="Search breed / type…" value={q}
              onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} style={{ width: 220 }} />
            <button className="btn ghost sm" onClick={load}><Search size={14} /> Search</button>
            <select value={fStatus} onChange={e => setFStatus(e.target.value as Filter)} style={{ fontSize: 13, padding: '6px 8px', borderRadius: 8 }} title="Filter by status">
              {FILTERS.map(f => <option key={f.v} value={f.v}>{f.label}</option>)}
            </select>
          </div>
        </div>
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No listings match this filter." /> : (
          <table>
            <thead><tr><th>Breed / Type</th><th>Seller</th><th>Price</th><th>Location</th><th>Status</th><th>Approval</th><th>Posted</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => {
                const st = liveLabel(r);
                return (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setOpen360(r.id)}>
                    <td><b>{r.breed || '—'}</b><div className="muted">{r.type}</div></td>
                    <td>{r.users?.full_name || (r.users?.handle ? '@' + r.users.handle : '—')}</td>
                    <td>{inr(r.price)}</td>
                    <td className="muted">{loc(r)}</td>
                    <td><span className={'badge ' + (st === 'active' ? 'b-ok' : st === 'sold' ? 'b-info' : st === 'expired' ? 'b-warn' : 'b-mut')}>{st}</span></td>
                    <td><span className={'badge ' + (r.approval_status === 'approved' ? 'b-ok' : r.approval_status === 'rejected' ? 'b-danger' : 'b-warn')}>{r.approval_status}</span></td>
                    <td className="muted">{timeAgo(r.created_at)}</td>
                    <td onClick={e => e.stopPropagation()}><button className="btn ghost sm" onClick={() => setOpen360(r.id)}><Eye size={13} /> View</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {open360 && <Listing360 listingId={open360} onClose={() => setOpen360(null)} onChanged={load} />}
    </>
  );
}
