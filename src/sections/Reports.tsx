import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Flag, Trash2, Ban, X } from 'lucide-react';
import { Empty, Loading, timeAgo, inr } from '../ui';

export default function Reports({ onChange }:{ onChange?:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<'open'|'all'>('open');

  async function load(){
    setLoading(true);
    let q=supabase.from('reports').select(
      '*, listing:listings(id,breed,price,status,user_id), reporter:users!reports_reporter_id_fkey(full_name,handle), reported:users!reports_reported_user_id_fkey(full_name,handle)'
    ).order('created_at',{ascending:false}).limit(100);
    if(tab==='open') q=q.eq('status','open');
    const { data,error }=await q;
    if(error){ alert(error.message); }
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  async function mark(id:string,status:string){
    await supabase.from('reports').update({ status, reviewed_at:new Date().toISOString() }).eq('id',id); load(); onChange?.();
  }
  async function removeListing(r:any){
    if(!r.listing?.id){ alert('Listing already removed.'); await mark(r.id,'actioned'); return; }
    if(!confirm('Remove this listing from the app? This deletes it.')) return;
    const { error }=await supabase.from('listings').delete().eq('id',r.listing.id);
    if(error){ alert(error.message); return; }
    await mark(r.id,'actioned');
  }
  async function banUser(userId:string|undefined,reportId:string){
    if(!userId){ alert('No user on this report.'); return; }
    if(!confirm('Ban this user? They will be blocked from using the app.')) return;
    const { error }=await supabase.from('users').update({ banned:true }).eq('id',userId);
    if(error){ alert(error.message); return; }
    await mark(reportId,'actioned');
  }

  const open=rows.filter(r=>r.status==='open').length;

  return (
    <>
      <h1 className="h1">Reports</h1>
      <p className="sub">Fraud and behaviour reports from users. Remove the listing or ban the user, then dismiss.</p>
      <div className="card">
        <div className="card-h">
          <h2><Flag size={16}/> Reports{open>0 && <span className="badge b-warn" style={{marginLeft:8}}>{open} open</span>}</h2>
          <div className="row-acts">
            <button className={tab==='open'?'btn sm':'btn ghost sm'} onClick={()=>setTab('open')}>Open</button>
            <button className={tab==='all'?'btn sm':'btn ghost sm'} onClick={()=>setTab('all')}>All</button>
          </div>
        </div>
        {loading?<Loading/>:rows.length===0?<Empty text="No reports."/>:(
          <table>
            <thead><tr><th>Type</th><th>Reported</th><th>Reason</th><th>Details</th><th>By</th><th>When</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><span className="badge b-mut">{r.target_type}</span></td>
                  <td>{r.target_type==='listing'
                      ? (r.listing ? <><b>{r.listing.breed||'Listing'}</b> <span className="muted">{inr(r.listing.price)} · {r.listing.status}</span></> : <span className="muted">deleted</span>)
                      : (r.reported ? <b>{r.reported.full_name||('@'+(r.reported.handle||'user'))}</b> : <span className="muted">unknown</span>)}</td>
                  <td>{r.reason}</td>
                  <td className="muted" style={{maxWidth:240,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.details||'—'}</td>
                  <td className="muted">{r.reporter?('@'+(r.reporter.handle||r.reporter.full_name||'user')):'—'}</td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><div className="row-acts">
                    {r.status==='open' ? <>
                      {r.target_type==='listing' && <button className="btn danger sm" onClick={()=>removeListing(r)}><Trash2 size={13}/> Remove listing</button>}
                      <button className="btn danger sm" onClick={()=>banUser(r.target_type==='listing'?r.listing?.user_id:r.reported_user_id, r.id)}><Ban size={13}/> Ban user</button>
                      <button className="btn ghost sm" onClick={()=>mark(r.id,'dismissed')}><X size={13}/> Dismiss</button>
                    </> : <span className="badge b-mut">{r.status}</span>}
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
