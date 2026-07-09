import { useEffect, useState } from 'react';
import { supabase, adminPhones } from '../supabase';
import { ShieldCheck, Check, X } from 'lucide-react';
import { Empty, Loading, timeAgo, useParamState, useRowKeys } from '../ui';

export default function Kyc({ onChange }:{ onChange?:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useParamState<'pending'|'all'>('tab','pending');
  const [zoom,setZoom]=useState<{url:string;label:string}|null>(null);
  const [picked,setPicked]=useState<Set<string>>(new Set());
  // j/k + a/r on the focused row (the confirm() dialog still gates each decision).
  const [sel]=useRowKeys(rows.length,{
    a:(i)=>{ const r=rows[i]; if(r?.status==='pending' && !zoom) decide(r,true); },
    r:(i)=>{ const r=rows[i]; if(r?.status==='pending' && !zoom) decide(r,false); },
    x:(i)=>{ const r=rows[i]; if(r?.status==='pending') togglePick(r.id); },
  });

  function togglePick(id:string){ setPicked(p=>{ const s=new Set(p); s.has(id)?s.delete(id):s.add(id); return s; }); }
  async function bulkDecide(approveIt:boolean){
    const list=rows.filter(r=>picked.has(r.id)&&r.status==='pending');
    if(list.length===0) return;
    if(!confirm(`${approveIt?'Approve':'Reject'} ${list.length} verification${list.length>1?'s':''}? Both photos stay on file.`)) return;
    if(approveIt){
      const { error }=await supabase.from('users').update({ aadhaar_verified:true }).in('id',list.map(r=>r.user_id));
      if(error){ alert(error.message); return; }
    }
    const { error }=await supabase.from('kyc_submissions')
      .update({ status:approveIt?'approved':'rejected', reviewed_at:new Date().toISOString() })
      .in('id',list.map(r=>r.id));
    if(error){ alert('Could not update KYC: '+error.message); return; }
    setPicked(new Set()); load(); onChange?.();
  }

  async function load(){
    setLoading(true);
    let q=supabase.from('kyc_submissions').select(
      '*, user:users!kyc_submissions_user_id_fkey(full_name,handle,aadhaar_verified)'
    ).order('created_at',{ascending:false}).limit(100);
    if(tab==='pending') q=q.eq('status','pending');
    const { data,error }=await q;
    if(error){ alert(error.message); }
    const list:any[]=(data||[]);
    const phones=await adminPhones(list.map((r:any)=>r.user_id));
    list.forEach((r:any)=>{ if(r.user) r.user.phone=phones[r.user_id]||null; });
    await Promise.all(list.map(async (r:any)=>{
      if(r.aadhaar_path){ const a=await supabase.storage.from('kyc').createSignedUrl(r.aadhaar_path,3600); r.a_url=a.data?.signedUrl; }
      if(r.selfie_path){ const s=await supabase.storage.from('kyc').createSignedUrl(r.selfie_path,3600); r.s_url=s.data?.signedUrl; }
    }));
    setRows(list); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  async function decide(r:any, approveIt:boolean){
    if(!confirm(approveIt
      ? 'Approve and give the verified badge? Both photos stay on file (users upload a masked Aadhaar).'
      : 'Reject this verification? Both photos stay on file (users upload a masked Aadhaar).')) return;
    if(approveIt){
      const { error }=await supabase.from('users').update({ aadhaar_verified:true }).eq('id',r.user_id);
      if(error){ alert(error.message); return; }
    }
    // Both photos are retained on file as the verification/fraud trail (Aadhaar is uploaded masked).
    const { error }=await supabase.from('kyc_submissions').update({ status:approveIt?'approved':'rejected', reviewed_at:new Date().toISOString() }).eq('id',r.id);
    if(error){
      // Roll back the badge so we don't leave the user verified with the request still pending.
      if(approveIt) await supabase.from('users').update({ aadhaar_verified:false }).eq('id',r.user_id);
      alert('Could not update KYC: '+error.message); return;
    }
    load(); onChange?.();
  }

  const pending=rows.filter(r=>r.status==='pending').length;

  return (
    <>
      <h1 className="h1">Verifications</h1>
      <p className="sub">KYC verification requests. Check the Aadhaar against the selfie, call the user to confirm, then Approve to give the blue verified badge. Both photos are kept on file for the verification record — users upload a masked Aadhaar (first 8 digits hidden).</p>
      <div className="card">
        <div className="card-h">
          <h2><ShieldCheck size={16}/> Requests{pending>0 && <span className="badge b-warn" style={{marginLeft:8}}>{pending} pending</span>}</h2>
          <div className="row-acts">
            <button className={tab==='pending'?'btn sm':'btn ghost sm'} onClick={()=>setTab('pending')}>Pending</button>
            <button className={tab==='all'?'btn sm':'btn ghost sm'} onClick={()=>setTab('all')}>All</button>
          </div>
        </div>
        {picked.size>0 && (
          <div className="bulkbar">
            <b>{picked.size}</b> selected
            <button className="btn ok sm" onClick={()=>bulkDecide(true)}><Check size={13}/> Approve all</button>
            <button className="btn danger sm" onClick={()=>bulkDecide(false)}><X size={13}/> Reject all</button>
            <button className="btn ghost sm" onClick={()=>setPicked(new Set())}>Clear</button>
          </div>
        )}
        {loading?<Loading/>:rows.length===0?<Empty text="No verification requests."/>:(
          <table>
            <thead><tr>
              <th className="ck"><input type="checkbox"
                checked={picked.size>0&&picked.size===rows.filter(r=>r.status==='pending').length}
                onChange={e=>setPicked(e.target.checked?new Set(rows.filter(r=>r.status==='pending').map(r=>r.id)):new Set())}/></th>
              <th>User</th><th>Phone</th><th>Aadhaar</th><th>Selfie</th><th>Status</th><th>When</th><th></th></tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.id} className={i===sel?'krow':''}>
                  <td className="ck">{r.status==='pending' && <input type="checkbox" checked={picked.has(r.id)} onChange={()=>togglePick(r.id)}/>}</td>
                  <td><b>{r.user?.full_name||('@'+(r.user?.handle||'user'))}</b>{r.user?.aadhaar_verified && <span className="badge b-ok" style={{marginLeft:6}}>verified</span>}</td>
                  <td className="muted">{r.user?.phone||'—'}</td>
                  <td>{r.a_url?<img src={r.a_url} onClick={()=>setZoom({url:r.a_url,label:'Aadhaar'})} style={{height:44,borderRadius:4,cursor:'zoom-in'}}/>:<span className="muted">—</span>}</td>
                  <td>{r.s_url?<img src={r.s_url} onClick={()=>setZoom({url:r.s_url,label:'Selfie'})} style={{height:44,borderRadius:4,cursor:'zoom-in'}}/>:<span className="muted">—</span>}</td>
                  <td><span className={'badge '+(r.status==='approved'?'b-ok':r.status==='rejected'?'b-danger':'b-warn')}>{r.status}</span></td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><div className="row-acts">
                    {r.status==='pending' && <>
                      <button className="btn ok sm" onClick={()=>decide(r,true)}><Check size={13}/> Approve</button>
                      <button className="btn danger sm" onClick={()=>decide(r,false)}><X size={13}/> Reject</button>
                    </>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {zoom && (
        <div onClick={()=>setZoom(null)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,zIndex:1000,cursor:'zoom-out'}}>
          <div style={{color:'#fff',fontWeight:600,fontSize:15}}>{zoom.label} — click anywhere to close</div>
          <img src={zoom.url} onClick={(e)=>e.stopPropagation()}
            style={{maxWidth:'92vw',maxHeight:'82vh',borderRadius:8,boxShadow:'0 12px 48px rgba(0,0,0,0.6)',cursor:'default'}}/>
        </div>
      )}
    </>
  );
}
