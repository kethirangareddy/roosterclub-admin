import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Award, Check, X } from 'lucide-react';
import { Empty, Loading, timeAgo } from '../ui';

const BADGES:{v:string;label:string}[]=[
  {v:'bronze',label:'Bronze'},
  {v:'silver',label:'Silver'},
  {v:'gold_star',label:'Gold Star'},
  {v:'legendary',label:'Legendary'},
  {v:'founding_member',label:'Founding Member'},
];

export default function BadgeRequests({ onChange }:{ onChange?:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<'pending'|'all'>('pending');
  const [pick,setPick]=useState<Record<string,string>>({});

  async function load(){
    setLoading(true);
    let q=supabase.from('badge_requests')
      .select('*, user:users!badge_requests_user_id_fkey(full_name,handle,phone,badge)')
      .order('created_at',{ascending:false}).limit(100);
    if(tab==='pending') q=q.eq('status','pending');
    const { data,error }=await q;
    if(error){ alert(error.message); }
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  async function approve(r:any){
    const badge=pick[r.id]||r.user?.badge||'bronze';
    if(!confirm(`Give ${r.user?.full_name||'this user'} the ${badge} badge?`)) return;
    // badge_source:'admin' protects this badge from the nightly earned-badge cron (it only recomputes non-admin badges).
    const u=await supabase.from('users').update({ badge, badge_source:'admin', badge_awarded_at:new Date().toISOString() }).eq('id',r.user_id);
    if(u.error){ alert(u.error.message); return; }
    await supabase.from('badge_requests').update({ status:'approved', reviewed_at:new Date().toISOString() }).eq('id',r.id);
    load(); onChange?.();
  }
  async function reject(r:any){
    if(!confirm('Reject this badge request?')) return;
    await supabase.from('badge_requests').update({ status:'rejected', reviewed_at:new Date().toISOString() }).eq('id',r.id);
    load(); onChange?.();
  }

  const pending=rows.filter(r=>r.status==='pending').length;

  return (
    <>
      <h1 className="h1">Badge Requests</h1>
      <p className="sub">Users asking to be reviewed for a badge. Call them to confirm, pick a badge, then Approve — or Reject.</p>
      <div className="card">
        <div className="card-h">
          <h2><Award size={16}/> Requests{pending>0 && <span className="badge b-warn" style={{marginLeft:8}}>{pending} pending</span>}</h2>
          <div className="row-acts">
            <button className={tab==='pending'?'btn sm':'btn ghost sm'} onClick={()=>setTab('pending')}>Pending</button>
            <button className={tab==='all'?'btn sm':'btn ghost sm'} onClick={()=>setTab('all')}>All</button>
          </div>
        </div>
        {loading?<Loading/>:rows.length===0?<Empty text="No badge requests."/>:(
          <table>
            <thead><tr><th>User</th><th>Phone</th><th>Current</th><th>Status</th><th>When</th><th>Assign</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.user?.full_name||('@'+(r.user?.handle||'user'))}</b></td>
                  <td className="muted">{r.user?.phone||'—'}</td>
                  <td className="muted">{r.user?.badge||'—'}</td>
                  <td><span className={'badge '+(r.status==='approved'?'b-ok':r.status==='rejected'?'b-danger':'b-warn')}>{r.status}</span></td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td>
                    {r.status==='pending'
                      ? <select value={pick[r.id]||r.user?.badge||'bronze'} onChange={e=>setPick(p=>({...p,[r.id]:e.target.value}))}>
                          {BADGES.map(b=><option key={b.v} value={b.v}>{b.label}</option>)}
                        </select>
                      : '—'}
                  </td>
                  <td><div className="row-acts">
                    {r.status==='pending' && <>
                      <button className="btn ok sm" onClick={()=>approve(r)}><Check size={13}/> Approve</button>
                      <button className="btn danger sm" onClick={()=>reject(r)}><X size={13}/> Reject</button>
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
