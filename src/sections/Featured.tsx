import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Star, Zap } from 'lucide-react';
import { Empty, Loading, timeAgo, inr } from '../ui';

export default function Featured({ onChange }:{ onChange:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<'pending'|'active'>('pending');

  async function load(){
    setLoading(true);
    let q=supabase.from('feature_requests')
      .select('*, users:user_id(full_name, phone, handle)')
      .order('created_at',{ascending:false});
    if(tab==='pending') q=q.eq('status','pending');
    else q=q.eq('status','active');
    const { data }=await q;
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  async function approve(r:any){
    const hours=Number(prompt('Feature for how many hours?', '24'))||24;
    const { error }=await supabase.rpc('activate_feature',{ p_request:r.id, p_hours:hours });
    if(error){ alert(error.message); return; }
    load(); onChange();
  }
  async function reject(r:any){
    if(!confirm('Reject this feature request?')) return;
    const { error }=await supabase.from('feature_requests').update({ status:'rejected' }).eq('id',r.id);
    if(error){ alert('Could not reject: '+error.message); return; }
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
        {loading?<Loading/>:rows.length===0?<Empty text={tab==='pending'?'No pending requests.':'No active features.'}/>:(
          <table>
            <thead><tr><th>User</th><th>Amount</th><th>UPI ref</th><th>Requested</th>{tab==='active'&&<th>Until</th>}<th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.users?.full_name||'—'}</b><div className="muted">{r.users?.phone||(r.users?.handle?'@'+r.users.handle:'')}</div></td>
                  <td>{inr(r.amount)}</td>
                  <td className="muted">{r.upi_ref||'—'}</td>
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
