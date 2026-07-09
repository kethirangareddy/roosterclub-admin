import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Flag, Trash2, Ban, X } from 'lucide-react';
import { Empty, Loading, timeAgo, inr, useParamState, useRowKeys } from '../ui';

export default function Reports({ onChange }:{ onChange?:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useParamState<'open'|'all'>('tab','open');
  const [picked,setPicked]=useState<Set<string>>(new Set());
  // j/k + d dismiss. Remove/ban stay click-only — too destructive for a single keystroke.
  const [sel]=useRowKeys(rows.length,{
    d:(i)=>{ const r=rows[i]; if(r?.status==='open') mark(r.id,'dismissed'); },
    x:(i)=>{ const r=rows[i]; if(r?.status==='open') togglePick(r.id); },
  });

  function togglePick(id:string){ setPicked(p=>{ const s=new Set(p); s.has(id)?s.delete(id):s.add(id); return s; }); }
  async function bulkDismiss(){
    const ids=[...picked];
    if(!confirm(`Dismiss ${ids.length} report${ids.length>1?'s':''}?`)) return;
    const { error }=await supabase.from('reports')
      .update({ status:'dismissed', reviewed_at:new Date().toISOString() }).in('id',ids);
    if(error){ alert('Bulk dismiss failed: '+error.message); return; }
    setPicked(new Set()); load(); onChange?.();
  }

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
    const { error }=await supabase.from('reports').update({ status, reviewed_at:new Date().toISOString() }).eq('id',id); if(error){ alert('Could not update report: '+error.message); return; } load(); onChange?.();
  }
  async function removeListing(r:any){
    if(!r.listing?.id){ alert('Listing already removed.'); await mark(r.id,'actioned'); return; }
    // Item 16 — soft delete: 30-day undo window (restore from the listing's 360), auto-purged after.
    if(!confirm('Remove this listing from the app? You can restore it for 30 days (search it in ⌘K → Restore).')) return;
    const { error }=await supabase.from('listings')
      .update({ status:'removed', removed_at:new Date().toISOString() }).eq('id',r.listing.id);
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
        {picked.size>0 && (
          <div className="bulkbar">
            <b>{picked.size}</b> selected
            <button className="btn ghost sm" onClick={bulkDismiss}><X size={13}/> Dismiss all</button>
            <button className="btn ghost sm" onClick={()=>setPicked(new Set())}>Clear</button>
          </div>
        )}
        {loading?<Loading/>:rows.length===0?<Empty text="No reports."/>:(
          <table>
            <thead><tr>
              <th className="ck"><input type="checkbox"
                checked={picked.size>0&&picked.size===rows.filter(r=>r.status==='open').length}
                onChange={e=>setPicked(e.target.checked?new Set(rows.filter(r=>r.status==='open').map(r=>r.id)):new Set())}/></th>
              <th>Type</th><th>Reported</th><th>Reason</th><th>Details</th><th>By</th><th>When</th><th></th></tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.id} className={i===sel?'krow':''}>
                  <td className="ck">{r.status==='open' && <input type="checkbox" checked={picked.has(r.id)} onChange={()=>togglePick(r.id)}/>}</td>
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
