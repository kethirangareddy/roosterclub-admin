import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Truck, Check } from 'lucide-react';
import { Empty, Loading, loc, inr, timeAgo } from '../ui';

export default function LiveFeed({ onChange }:{ onChange:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<'pending'|'approved'>('pending');

  async function load(){
    setLoading(true);
    const { data }=await supabase.from('live_feed_sellers').select('*')
      .eq('approved',tab==='approved').order('created_at',{ascending:false});
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  async function approve(id:string){
    await supabase.from('live_feed_sellers').update({ approved:true }).eq('id',id);
    setRows(r=>r.filter(x=>x.id!==id)); onChange();
  }
  async function remove(id:string){
    if(!confirm('Remove this live-feed seller?')) return;
    await supabase.from('live_feed_sellers').delete().eq('id',id);
    setRows(r=>r.filter(x=>x.id!==id)); onChange();
  }

  return (
    <>
      <h1 className="h1">Live Feed</h1>
      <p className="sub">BSF larvae / live-insect feed sellers. Approve requests to list them in-app.</p>
      <div className="tabbar">
        <button className={tab==='pending'?'active':''} onClick={()=>setTab('pending')}>Pending requests</button>
        <button className={tab==='approved'?'active':''} onClick={()=>setTab('approved')}>Approved</button>
      </div>
      <div className="card">
        <div className="card-h"><h2><Truck size={16}/> {tab==='pending'?'Requests':'Approved sellers'} ({rows.length})</h2></div>
        {loading?<Loading/>:rows.length===0?<Empty text={tab==='pending'?'No pending requests.':'No approved sellers yet.'}/>:(
          <table>
            <thead><tr><th>Name</th><th>Feed type</th><th>Price/kg</th><th>Availability</th><th>Phone</th><th>Location</th><th>Requested</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.name}</b></td>
                  <td>{r.feed_type||'—'}</td>
                  <td>{inr(r.price_per_kg)}</td>
                  <td className="muted">{r.availability||'—'}</td>
                  <td className="muted">{r.phone||'—'}</td>
                  <td className="muted">{loc(r)}</td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><div className="row-acts">
                    {tab==='pending' && <button className="btn ok sm" onClick={()=>approve(r.id)}><Check size={13}/> Approve</button>}
                    <button className="btn danger sm" onClick={()=>remove(r.id)}>Remove</button>
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
