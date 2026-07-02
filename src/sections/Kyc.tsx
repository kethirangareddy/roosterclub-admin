import { useEffect, useState } from 'react';
import { supabase, adminPhones } from '../supabase';
import { ShieldCheck, Check, X } from 'lucide-react';
import { Empty, Loading, timeAgo } from '../ui';

export default function Kyc({ onChange }:{ onChange?:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<'pending'|'all'>('pending');

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
      if(r.status==='pending'){
        const a=await supabase.storage.from('kyc').createSignedUrl(r.aadhaar_path,3600);
        const s=await supabase.storage.from('kyc').createSignedUrl(r.selfie_path,3600);
        r.a_url=a.data?.signedUrl; r.s_url=s.data?.signedUrl;
      }
    }));
    setRows(list); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  async function decide(r:any, approveIt:boolean){
    if(!confirm(approveIt
      ? 'Approve and give the verified badge? The Aadhaar photo is deleted; the selfie is kept on file for safety.'
      : 'Reject this verification? The Aadhaar photo is deleted; the selfie is kept on file for safety.')) return;
    if(approveIt){
      const { error }=await supabase.from('users').update({ aadhaar_verified:true }).eq('id',r.user_id);
      if(error){ alert(error.message); return; }
    }
    // Delete ONLY the Aadhaar (unlawful to retain long-term); keep the selfie as the verification/fraud trail.
    if(r.aadhaar_path) await supabase.storage.from('kyc').remove([r.aadhaar_path]);
    const { error }=await supabase.from('kyc_submissions').update({ status:approveIt?'approved':'rejected', reviewed_at:new Date().toISOString(), aadhaar_path:null }).eq('id',r.id);
    if(error){ alert('Could not update KYC: '+error.message); return; }
    load(); onChange?.();
  }

  const pending=rows.filter(r=>r.status==='pending').length;

  return (
    <>
      <h1 className="h1">Verifications</h1>
      <p className="sub">KYC verification requests. Check the Aadhaar against the selfie, call the user to confirm, then Approve to give the blue verified badge. The Aadhaar photo is deleted once you decide; the selfie is kept on file for safety.</p>
      <div className="card">
        <div className="card-h">
          <h2><ShieldCheck size={16}/> Requests{pending>0 && <span className="badge b-warn" style={{marginLeft:8}}>{pending} pending</span>}</h2>
          <div className="row-acts">
            <button className={tab==='pending'?'btn sm':'btn ghost sm'} onClick={()=>setTab('pending')}>Pending</button>
            <button className={tab==='all'?'btn sm':'btn ghost sm'} onClick={()=>setTab('all')}>All</button>
          </div>
        </div>
        {loading?<Loading/>:rows.length===0?<Empty text="No verification requests."/>:(
          <table>
            <thead><tr><th>User</th><th>Phone</th><th>Aadhaar</th><th>Selfie</th><th>Status</th><th>When</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.user?.full_name||('@'+(r.user?.handle||'user'))}</b>{r.user?.aadhaar_verified && <span className="badge b-ok" style={{marginLeft:6}}>verified</span>}</td>
                  <td className="muted">{r.user?.phone||'—'}</td>
                  <td>{r.a_url?<a href={r.a_url} target="_blank" rel="noreferrer"><img src={r.a_url} style={{height:44,borderRadius:4}}/></a>:<span className="muted">—</span>}</td>
                  <td>{r.s_url?<a href={r.s_url} target="_blank" rel="noreferrer"><img src={r.s_url} style={{height:44,borderRadius:4}}/></a>:<span className="muted">—</span>}</td>
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
    </>
  );
}
