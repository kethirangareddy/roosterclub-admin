import { useEffect, useState } from 'react';
import { supabase, adminPhones } from '../supabase';
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
  const [fState,setFState]=useState<string>('all'); // location filters
  const [fDist,setFDist]=useState<string>('all');

  async function load(){
    setLoading(true);
    let q=supabase.from('badge_requests')
      .select('*, user:users!badge_requests_user_id_fkey(full_name,handle,badge,state,district)')
      .order('created_at',{ascending:false}).limit(100);
    if(tab==='pending') q=q.eq('status','pending');
    const { data,error }=await q;
    if(error){ alert(error.message); }
    const list=data||[];
    const phones=await adminPhones(list.map((r:any)=>r.user_id));
    setRows(list.map((r:any)=>({...r, user:r.user?{...r.user, phone:phones[r.user_id]||null}:r.user}))); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  async function approve(r:any){
    const badge=pick[r.id]||r.user?.badge||'bronze';
    if(!confirm(`Give ${r.user?.full_name||'this user'} the ${badge} badge?`)) return;
    // badge_source:'admin' protects this badge from the nightly earned-badge cron (it only recomputes non-admin badges).
    const u=await supabase.from('users').update({ badge, badge_source:'admin', badge_awarded_at:new Date().toISOString() }).eq('id',r.user_id);
    if(u.error){ alert(u.error.message); return; }
    const { error }=await supabase.from('badge_requests').update({ status:'approved', reviewed_at:new Date().toISOString() }).eq('id',r.id);
    if(error){ alert('Badge granted, but could not mark the request approved: '+error.message); }
    load(); onChange?.();
  }
  async function reject(r:any){
    if(!confirm('Reject this badge request?')) return;
    const { error }=await supabase.from('badge_requests').update({ status:'rejected', reviewed_at:new Date().toISOString() }).eq('id',r.id);
    if(error){ alert('Could not reject: '+error.message); return; }
    load(); onChange?.();
  }

  const pending=rows.filter(r=>r.status==='pending').length;
  // Location filters (client-side over the loaded requests).
  const bStates = Array.from(new Set(rows.map(r=>r.user?.state).filter(Boolean))).sort();
  const bDists = Array.from(new Set(rows.filter(r=>fState==='all'||r.user?.state===fState).map(r=>r.user?.district).filter(Boolean))).sort();
  const shown = rows.filter(r=> (fState==='all'||r.user?.state===fState) && (fDist==='all'||r.user?.district===fDist));

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
            <select value={fState} onChange={e=>{setFState(e.target.value);setFDist('all');}} style={{fontSize:12,padding:'4px 8px',borderRadius:8}} title="Filter by state">
              <option value="all">All states</option>
              {bStates.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select value={fDist} onChange={e=>setFDist(e.target.value)} style={{fontSize:12,padding:'4px 8px',borderRadius:8}} title="Filter by district">
              <option value="all">All districts</option>
              {bDists.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        {loading?<Loading/>:shown.length===0?<Empty text="No badge requests."/>:(
          <table>
            <thead><tr><th>User</th><th>Phone</th><th>Current</th><th>Status</th><th>When</th><th>Assign</th><th></th></tr></thead>
            <tbody>
              {shown.map(r=>(
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
