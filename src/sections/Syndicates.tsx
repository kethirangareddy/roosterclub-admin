import { useEffect, useState } from 'react';
import { supabase, adminPhones } from '../supabase';
import { ShieldCheck, Check, X } from 'lucide-react';
import { Empty, Loading, timeAgo, UserLink, Copyable } from '../ui';

export default function Syndicates({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

  async function load() {
    setLoading(true);
    let q = supabase.from('syndicates')
      .select('*, owner:users!syndicates_owner_id_fkey(full_name,handle,badge,state,district)')
      .order('created_at', { ascending: false }).limit(200);
    if (tab === 'pending') q = q.eq('status', 'pending');
    const { data, error } = await q;
    if (error) { alert(error.message); }
    const list = data || [];
    const phones = await adminPhones(list.map((r: any) => r.owner_id));
    setRows(list.map((r: any) => ({ ...r, owner: r.owner ? { ...r.owner, phone: phones[r.owner_id] || null } : r.owner })));
    setLoading(false);
  }
  useEffect(() => { load(); }, [tab]);

  async function approve(r: any) {
    if (!confirm(`Approve the syndicate "${r.name}"? Its invite code goes live and the owner can invite members.`)) return;
    const { error } = await supabase.rpc('approve_syndicate', { p_id: r.id });
    if (error) { alert(error.message); return; }
    load(); onChange?.();
  }
  async function reject(r: any) {
    if (!confirm(`Reject "${r.name}"?`)) return;
    const { error } = await supabase.rpc('reject_syndicate', { p_id: r.id });
    if (error) { alert(error.message); return; }
    load(); onChange?.();
  }

  const pending = rows.filter(r => r.status === 'pending').length;

  return (
    <>
      <h1 className="h1">Syndicates</h1>
      <p className="sub">Invite-only breeder circles. Review new syndicates, then Approve to make them live (and unlock their invite code) or Reject.</p>
      <div className="card">
        <div className="card-h">
          <h2><ShieldCheck size={16} /> Syndicates{pending > 0 && <span className="badge b-warn" style={{ marginLeft: 8 }}>{pending} pending</span>}</h2>
          <div className="row-acts">
            <button className={tab === 'pending' ? 'btn sm' : 'btn ghost sm'} onClick={() => setTab('pending')}>Pending</button>
            <button className={tab === 'all' ? 'btn sm' : 'btn ghost sm'} onClick={() => setTab('all')}>All</button>
          </div>
        </div>
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No syndicates." /> : (
          <table>
            <thead><tr><th>Name</th><th>Owner</th><th>Phone</th><th>Area</th><th>Status</th><th>When</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <b>{r.name}</b>
                    {r.motto ? <div className="muted" style={{ fontSize: 12 }}>{r.motto}</div> : null}
                    {r.status === 'approved' && r.invite_code
                      ? <div className="muted" style={{ fontSize: 12 }}>Code: <Copyable value={r.invite_code} title="Copy invite code"><b>{r.invite_code}</b></Copyable></div> : null}
                  </td>
                  <td><UserLink id={r.owner_id}>{r.owner?.full_name || ('@' + (r.owner?.handle || 'user'))}</UserLink>{r.owner?.badge ? <div className="muted" style={{ fontSize: 12 }}>{r.owner.badge}</div> : null}</td>
                  <td className="muted"><Copyable value={r.owner?.phone} title="Copy phone number"/></td>
                  <td className="muted">{[r.district, r.state].filter(Boolean).join(', ') || '—'}</td>
                  <td><span className={'badge ' + (r.status === 'approved' ? 'b-ok' : r.status === 'rejected' ? 'b-danger' : 'b-warn')}>{r.status}</span></td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><div className="row-acts">
                    {r.status === 'pending' && <>
                      <button className="btn ok sm" onClick={() => approve(r)}><Check size={13} /> Approve</button>
                      <button className="btn danger sm" onClick={() => reject(r)}><X size={13} /> Reject</button>
                    </>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
