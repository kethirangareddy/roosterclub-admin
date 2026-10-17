import { useEffect, useState, useRef } from 'react';
import { supabase, adminPhones } from '../supabase';
import { Star, Zap } from 'lucide-react';
import { Empty, Loading, LoadError, timeAgo, inr, UserLink, Copyable } from '../ui';
import { toast, ask, askText } from '../feedback';

export default function Featured({ onChange }:{ onChange:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadErr,setLoadErr]=useState(false); // a failed load must not read as 'No pending requests'
  const [tab,setTab]=useState<'pending'|'active'>('pending');

  const loadReq=useRef(0); // newest load wins — a slow reply for the old tab/filter is dropped
  async function load(){
    const my=++loadReq.current;
    setLoading(true);
    let q=supabase.from('feature_requests')
      .select('*, users:user_id(full_name, handle)')
      .order('created_at',{ascending:false});
    if(tab==='pending') q=q.eq('status','pending');
    else q=q.eq('status','active');
    const { data, error }=await q;
    if(my!==loadReq.current) return;
    if(error){ toast('Could not load feature requests: '+error.message); setLoadErr(true); setRows([]); setLoading(false); return; }
    setLoadErr(false);
    const list=data||[];
    const phones=await adminPhones(list.map((r:any)=>r.user_id));
    if(my!==loadReq.current) return;
    setRows(list.map((r:any)=>({...r, users:r.users?{...r.users, phone:phones[r.user_id]||null}:r.users}))); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  // One activation at a time: a second tap while the prompt or the reload is
  // still running used to activate (and charge time) twice.
  const approveBusy=useRef(false);
  async function approve(r:any){
    if(approveBusy.current) return;
    approveBusy.current=true;
    try{ await approveRun(r); } finally { approveBusy.current=false; }
  }
  async function approveRun(r:any){
    const input=await askText('Feature for how many hours?', '24');
    if(input===null) return; // Cancel pressed — don't activate
    // Empty answer keeps the default; anything else must be a real positive number.
    const txt=input.trim();
    const hours=txt===''?24:Number(txt);
    if(!Number.isFinite(hours) || hours<=0){ toast('Enter a number of hours greater than 0'); return; }
    const { error }=await supabase.rpc('activate_feature',{ p_request:r.id, p_hours:hours });
    if(error){ toast(error.message); return; }
    await load(); onChange();
  }
  async function reject(r:any){
    if(!await ask('Reject this feature request?')) return;
    const { error }=await supabase.from('feature_requests').update({ status:'rejected' }).eq('id',r.id);
    if(error){ toast('Could not reject: '+error.message); return; }
    load(); onChange();
  }

  return (
    <>
      <h1 className="h1">Featured Profiles</h1>
      <p className="sub">₹99/day profile feature. Confirm the UPI payment, then activate — the profile pins to the top of the Market.</p>
      <div className="tabbar">
        <button className={tab==='pending'?'active':''} onClick={()=>setTab('pending')}>Pending</button>
        <button className={tab==='active'?'active':''} onClick={()=>setTab('active')}>Active</button>
      </div>
      <div className="card">
        <div className="card-h"><h2><Star size={16}/> {tab==='pending'?'Requests':'Active features'} ({rows.length})</h2></div>
        {loading?<Loading/>:loadErr?<LoadError what="feature requests" onRetry={load}/>:rows.length===0?<Empty text={tab==='pending'?'No pending requests.':'No active features.'}/>:(
          <table>
            <thead><tr><th>User</th><th>Amount</th><th>UPI ref</th><th>Requested</th>{tab==='active'&&<th>Until</th>}<th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td>
                    <UserLink id={r.user_id}><b>{r.users?.full_name||'View user'}</b></UserLink>
                    <div className="muted">{r.users?.phone
                      ? <Copyable value={r.users.phone} title="Copy phone number"/>
                      : (r.users?.handle?'@'+r.users.handle:'')}</div>
                  </td>
                  <td>{inr(r.amount)}</td>
                  <td className="muted"><Copyable value={r.upi_ref} title="Copy UPI reference"/></td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  {tab==='active' && <td className="muted">{r.featured_until?new Date(r.featured_until).toLocaleString('en-IN'):'—'}</td>}
                  <td><div className="row-acts">
                    {tab==='pending' && <>
                      <button className="btn ok sm" onClick={()=>approve(r)}><Zap size={13}/> Activate</button>
                      <button className="btn danger sm" onClick={()=>reject(r)}>Reject</button>
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
