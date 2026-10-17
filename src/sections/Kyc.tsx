import { useEffect, useRef, useState } from 'react';
import { supabase, adminPhones } from '../supabase';
import { ShieldCheck, Check, X, ZoomIn, ZoomOut, RotateCw, Copy, KeyRound, Upload } from 'lucide-react';
import { Empty, Loading, timeAgo, useParamState, useRowKeys, UserLink, Copyable, Modal } from '../ui';
import { useDetail, useOnChanged } from '../detail';
import { toast, ask } from '../feedback';

/* Verifications (KYC)
   - The list comes from admin_kyc_list (duplicate-ID count, attempts, live-selfie + UIDAI flags).
   - Photos open only in the review panel, through the kyc-admin service: 5-minute links, every view logged.
   - Decisions go through admin_kyc_decide, which sets the badge, stores the reason and sends the user
     a bell + push in their language. */

const ID_LABEL: Record<string, string> = {
  aadhaar: 'Aadhaar', voter_id: 'Voter ID', driving_licence: 'Driving Licence', pan: 'PAN', aadhaar_qr: 'Aadhaar QR',
};
export const REJECT_REASONS: { code: string; label: string }[] = [
  { code: 'photo_blurry', label: 'Photo blurry / dark' },
  { code: 'id_unreadable', label: 'ID not readable / cut off' },
  { code: 'face_mismatch', label: 'Selfie does not match ID' },
  { code: 'not_masked', label: 'Aadhaar not masked' },
  { code: 'wrong_document', label: 'Not a valid ID' },
  { code: 'selfie_not_live', label: 'Selfie not live' },
  { code: 'duplicate_id', label: 'ID used on another account' },
  { code: 'name_mismatch', label: 'Name does not match profile' },
  { code: 'other', label: 'Other (write a note)' },
];
const reasonLabel = (c?: string | null) => REJECT_REASONS.find(r => r.code === c)?.label || c || '';

export default function Kyc({ onChange }:{ onChange?:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useParamState<'pending'|'all'>('tab','pending');
  const [open,setOpen]=useState<any|null>(null);
  const [picked,setPicked]=useState<Set<string>>(new Set());
  const { openUser }=useDetail();
  useOnChanged(()=>load()); // an action in the side panel (approve, remove, ban…) refreshes this list

  const [sel]=useRowKeys(rows.length,{
    Enter:(i)=>{ const r=rows[i]; if(r && !open) setOpen(r); },
    x:(i)=>{ const r=rows[i]; if(r?.status==='pending') togglePick(r.id); },
    u:(i)=>{ const r=rows[i]; if(r && !open) openUser(r.user_id); },
  });

  // Ticks only ever cover rows you can see: cleared on tab switch, and dropped
  // when a row leaves the list. (Ticks used to survive a tab switch, so
  // "Reject all" could hit listings that weren't on screen.)
  useEffect(()=>{ setPicked(new Set()); },[tab]);
  useEffect(()=>{ setPicked(p=>{ const ids=new Set(rows.map((r:any)=>r.id)); const s=new Set([...p].filter(id=>ids.has(id))); return s.size===p.size?p:s; }); },[rows]);
  function togglePick(id:string){ setPicked(p=>{ const s=new Set(p); s.has(id)?s.delete(id):s.add(id); return s; }); }

  const loadReq=useRef(0); // newest load wins — a slow reply for the old tab/filter is dropped
  async function load(){
    const my=++loadReq.current;
    setLoading(true);
    const { data,error }=await supabase.rpc('admin_kyc_list',{ p_status: tab==='pending'?'pending':'all', p_limit: 200 });
    if(my!==loadReq.current) return;
    if(error){ toast(error.message); }
    const list:any[]=data||[];
    const phones=await adminPhones(list.map(r=>r.user_id));
    if(my!==loadReq.current) return;
    list.forEach(r=>{ r.phone=phones[r.user_id]||null; });
    setRows(list); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  const bulkBusy=useRef(false); // a second tap while the first batch runs does nothing
  async function bulkApprove(){
    if(bulkBusy.current) return;
    bulkBusy.current=true;
    try{ await bulkApproveRun(); } finally { bulkBusy.current=false; }
  }
  async function bulkApproveRun(){
    const list=rows.filter(r=>picked.has(r.id)&&r.status==='pending');
    if(!list.length) return;
    const risky=list.filter(r=>r.dup_users>0).length;
    if(!await ask(`Approve ${list.length} verification${list.length>1?'s':''} without opening each one?`+(risky?`\n\n${risky} of them use an ID seen on another account.`:''))) return;
    for(const r of list){
      const { error }=await supabase.rpc('admin_kyc_decide',{ p_id:r.id, p_approve:true });
      if(error){ toast(`@${r.handle||'user'}: ${error.message}`); break; }
    }
    setPicked(new Set()); load(); onChange?.();
  }

  const pending=rows.filter(r=>r.status==='pending').length;

  return (
    <>
      <h1 className="h1">Verifications</h1>
      <p className="sub">Open a request to see the ID and the selfie side by side. Every photo view is logged and the links expire after 5 minutes. Approve gives the verified badge; Reject needs a reason, which the user gets in their own language with a Resubmit button.</p>

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
            <button className="btn ok sm" onClick={bulkApprove}><Check size={13}/> Approve all</button>
            <button className="btn ghost sm" onClick={()=>setPicked(new Set())}>Clear</button>
          </div>
        )}
        {loading?<Loading/>:rows.length===0?<Empty text="No verification requests."/>:(
          <table>
            <thead><tr>
              <th className="ck"><input type="checkbox"
                checked={picked.size>0&&picked.size===rows.filter(r=>r.status==='pending').length}
                onChange={e=>setPicked(e.target.checked?new Set(rows.filter(r=>r.status==='pending').map(r=>r.id)):new Set())}/></th>
              <th>User</th><th>Phone</th><th>ID</th><th>Checks</th><th>Status</th><th>When</th><th></th></tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.id} className={i===sel?'krow':''} style={{cursor:'pointer'}} onClick={()=>setOpen(r)}>
                  <td className="ck" onClick={e=>e.stopPropagation()}>{r.status==='pending' && <input type="checkbox" checked={picked.has(r.id)} onChange={()=>togglePick(r.id)}/>}</td>
                  <td><UserLink id={r.user_id}><b>{r.full_name||('@'+(r.handle||'user'))}</b></UserLink>{r.aadhaar_verified && <span className="badge b-ok" style={{marginLeft:6}}>verified</span>}</td>
                  <td className="muted" onClick={e=>e.stopPropagation()}><Copyable value={r.phone} title="Copy phone number"/></td>
                  <td>{ID_LABEL[r.id_type]||r.id_type}{r.id_last4 && <span className="muted"> ··{r.id_last4}</span>}</td>
                  <td><Checks r={r}/></td>
                  <td>
                    <span className={'badge '+(r.status==='approved'?'b-ok':r.status==='rejected'?'b-danger':'b-warn')}>{r.status}</span>
                    {r.status==='rejected' && r.reject_reason && <div className="muted" style={{fontSize:11,marginTop:3}}>{reasonLabel(r.reject_reason)}</div>}
                  </td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><button className="btn ghost sm" onClick={e=>{ e.stopPropagation(); setOpen(r); }}>Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <UidaiCerts/>

      {open && <Review r={open} onClose={()=>setOpen(null)} onDone={()=>{ const id=open.id; setPicked(p=>{ if(!p.has(id)) return p; const s=new Set(p); s.delete(id); return s; }); setOpen(null); load(); onChange?.(); }}/>}
    </>
  );
}

function Checks({ r }:{ r:any }){
  return (
    <div className="row-acts">
      {r.uidai_verified && <span className="badge b-ok" title="UIDAI digital signature valid">UIDAI ✓</span>}
      {r.uidai_detail?.mobile_match===true && <span className="badge b-ok" title="Aadhaar mobile = account phone">Mobile ✓</span>}
      {r.uidai_verified && r.uidai_detail?.mobile_match===false && <span className="badge b-warn">Mobile ✗</span>}
      <span className={'badge '+(r.liveness_passed?'b-ok':'b-mut')} title="Blink / head-turn check in the app">{r.liveness_passed?'Live ✓':'No live check'}</span>
      {r.dup_users>0 && <span className="badge b-danger" title="Same ID details on other accounts">Duplicate ×{r.dup_users}</span>}
      {r.attempts>1 && <span className="badge b-mut">{r.attempts} tries</span>}
    </div>
  );
}

function Review({ r, onClose, onDone }:{ r:any; onClose:()=>void; onDone:()=>void }){
  const [urls,setUrls]=useState<{idUrl?:string|null;selfieUrl?:string|null;err?:string}|null>(null);
  const [rejecting,setRejecting]=useState(false);
  const [reason,setReason]=useState('');
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const { openUser }=useDetail();
  const expiry=useRef<number>(0);

  async function fetchUrls(){
    setUrls(null);
    if(r.photos_purged_at){ setUrls({ err:'Photos were deleted 30 days after rejection.' }); return; }
    const { data,error }=await supabase.functions.invoke('kyc-admin',{ body:{ action:'view', id:r.id } });
    if(error || (data as any)?.error){ setUrls({ err:'Could not open photos.' }); return; }
    expiry.current=Date.now()+((data as any).expiresIn||300)*1000;
    setUrls(data as any);
  }
  useEffect(()=>{ fetchUrls(); },[r.id]);

  const deciding=useRef(false);
  const afterG=useRef(0);
  useEffect(()=>{
    function onKey(e:KeyboardEvent){
      if((e.target as HTMLElement)?.tagName==='INPUT' || (e.target as HTMLElement)?.tagName==='TEXTAREA' || (e.target as HTMLElement)?.tagName==='SELECT') return;
      // Only when this review is the thing on top: never through a side panel
      // or a confirm dialog, and never twice while a decision is in flight.
      if(e.metaKey||e.ctrlKey||e.altKey) return;
      if(document.querySelector('.drawer-scrim, .ask-scrim, .cmdk')) return;
      // "g" starts a jump-to-screen shortcut: the next key is not approve/reject.
      if(e.key==='g'){ afterG.current=Date.now(); return; }
      if(Date.now()-afterG.current<1500){ afterG.current=0; return; }
      if(r.status!=='pending' || busy || deciding.current) return;
      if(e.key==='a') approve();
      if(e.key==='r') setRejecting(true);
    }
    window.addEventListener('keydown',onKey); return ()=>window.removeEventListener('keydown',onKey);
  });

  async function approve(){
    if(deciding.current) return;
    deciding.current=true;
    try{
      if(r.dup_users>0 && !await ask(`This ID appears on ${r.dup_users} other account(s). Approve anyway?`)) return;
      setBusy(true);
      const { error }=await supabase.rpc('admin_kyc_decide',{ p_id:r.id, p_approve:true });
      setBusy(false);
      if(error){ toast(error.message); return; }
      onDone();
    } finally { deciding.current=false; }
  }
  async function reject(){
    if(!reason){ toast('Pick a reason.'); return; }
    if(reason==='other' && !note.trim()){ toast('Write a short note for "Other".'); return; }
    setBusy(true);
    const { error }=await supabase.rpc('admin_kyc_decide',{ p_id:r.id, p_approve:false, p_reason:reason, p_note:note.trim()||null });
    setBusy(false);
    if(error){ toast(error.message); return; }
    onDone();
  }

  const expired=urls && !urls.err && Date.now()>expiry.current;
  const nameDiffers=r.id_name && r.full_name && norm(r.id_name)!==norm(r.full_name);

  return (
    <Modal title={`Review — ${r.full_name||('@'+(r.handle||'user'))}`} onClose={onClose}
      footer={r.status==='pending' ? (
        rejecting ? (
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',width:'100%'}}>
            <select value={reason} onChange={e=>setReason(e.target.value)} autoFocus
              style={{padding:'7px 10px',borderRadius:8,border:'1px solid var(--line-2)',fontSize:13}}>
              <option value="">Reason…</option>
              {REJECT_REASONS.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}
            </select>
            <input value={note} onChange={e=>setNote(e.target.value.slice(0,300))} placeholder="Note to user (optional)"
              style={{flex:1,minWidth:160,padding:'7px 10px',borderRadius:8,border:'1px solid var(--line-2)',fontSize:13}}/>
            <button className="btn ghost sm" onClick={()=>setRejecting(false)}>Back</button>
            <button className="btn danger sm" disabled={busy||!reason} onClick={reject}><X size={13}/> Reject</button>
          </div>
        ) : (
          <div className="row-acts">
            <button className="btn danger sm" disabled={busy} onClick={()=>setRejecting(true)}><X size={13}/> Reject <kbd>r</kbd></button>
            <button className="btn ok sm" disabled={busy} onClick={approve}><Check size={13}/> Approve <kbd>a</kbd></button>
          </div>
        )
      ) : undefined}>

      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:10,fontSize:13}}>
        <span className={'badge '+(r.status==='approved'?'b-ok':r.status==='rejected'?'b-danger':'b-warn')}>{r.status}</span>
        <b>{ID_LABEL[r.id_type]||r.id_type}</b>{r.id_last4 && <span className="muted">ending {r.id_last4}</span>}
        <Checks r={r}/>
        <button className="btn ghost sm" onClick={()=>openUser(r.user_id)}>Open profile</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12.5,marginBottom:10}}>
        <div><span className="muted">Profile name</span><div><b>{r.full_name||'—'}</b></div></div>
        <div><span className="muted">Name on ID</span><div><b style={{color:nameDiffers?'var(--danger)':undefined}}>{r.id_name||'—'}</b>{nameDiffers && <span className="muted"> (differs)</span>}</div></div>
        {r.uidai_detail && <>
          <div><span className="muted">UIDAI</span><div>{r.uidai_detail.yob?`Born ${r.uidai_detail.yob} · `:''}{r.uidai_detail.gender||''} · {[r.uidai_detail.district,r.uidai_detail.state].filter(Boolean).join(', ')}</div></div>
          <div><span className="muted">QR route</span><div>{r.uidai_detail.auto?'Auto-approved':'Needs your check'}{r.uidai_detail.mobile_match===false?' · mobile did not match':''}</div></div>
        </>}
        {r.quality && <div style={{gridColumn:'1 / -1'}}><span className="muted">Phone checks: </span>{qualityText(r.quality)}</div>}
        {r.status==='rejected' && <div style={{gridColumn:'1 / -1'}}><span className="muted">Rejected: </span>{reasonLabel(r.reject_reason)}{r.reject_note?` — ${r.reject_note}`:''}</div>}
      </div>

      {!urls ? <Loading/> : urls.err ? <Empty text={urls.err}/> : (
        <>
          {expired && <div className="bulkbar" style={{marginBottom:8}}>Links expired. <button className="btn sm" onClick={fetchUrls}>Reload photos</button></div>}
          <div style={{display:'grid',gridTemplateColumns:urls.idUrl&&urls.selfieUrl?'1fr 1fr':'1fr',gap:10}}>
            {urls.idUrl && <Zoomable url={urls.idUrl} label={ID_LABEL[r.id_type]||'ID'}/>}
            {urls.selfieUrl && <Zoomable url={urls.selfieUrl} label="Selfie"/>}
            {!urls.idUrl && r.id_type==='aadhaar_qr' && <div className="empty" style={{padding:20}}>No ID photo — verified from the UIDAI-signed QR.</div>}
          </div>
        </>
      )}
      <div className="muted" style={{fontSize:11,marginTop:8}}><Copy size={11} style={{verticalAlign:-1}}/> This view was logged. Request id <Copyable value={r.id}/></div>
    </Modal>
  );
}

function norm(s:string){ return s.toLowerCase().replace(/[^a-zఀ-౿ऀ-ॿ]/g,''); }
function qualityText(q:any){
  const bits:string[]=[];
  if(q.checker===false) bits.push('phone has no auto-checker');
  if(q.id_sharp!=null) bits.push(q.id_sharp?'ID sharp':'ID maybe blurry');
  if(q.id_bright!=null) bits.push(q.id_bright?'ID well lit':'ID dark');
  if(q.id_readable!=null) bits.push(q.id_readable?'text readable':'text hard to read');
  if(q.aadhaar_unmasked) bits.push('ALL 12 AADHAAR DIGITS VISIBLE');
  if(q.face_found!=null) bits.push(q.face_found?'face found':'no face found');
  if(q.liveness_steps) bits.push('selfie: '+(q.liveness_steps==='manual'?'taken by button (no live check)':q.liveness_steps));
  return bits.join(' · ')||'—';
}

function Zoomable({ url, label }:{ url:string; label:string }){
  const [z,setZ]=useState(1);
  const [rot,setRot]=useState(0);
  const [o,setO]=useState({x:50,y:50});
  return (
    <div style={{border:'1px solid var(--line)',borderRadius:10,overflow:'hidden',background:'#111'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 8px',background:'var(--surface-2)',fontSize:12,fontWeight:600}}>
        {label}
        <div className="row-acts">
          <button className="btn ghost sm" title="Zoom out" onClick={()=>setZ(v=>Math.max(1,v-0.5))}><ZoomOut size={13}/></button>
          <button className="btn ghost sm" title="Zoom in" onClick={()=>setZ(v=>Math.min(4,v+0.5))}><ZoomIn size={13}/></button>
          <button className="btn ghost sm" title="Rotate" onClick={()=>setRot(v=>(v+90)%360)}><RotateCw size={13}/></button>
        </div>
      </div>
      <div style={{height:340,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',cursor:z>1?'move':'zoom-in'}}
        onClick={()=>{ if(z===1) setZ(2); }}
        onMouseMove={e=>{ if(z===1) return; const b=(e.currentTarget as HTMLDivElement).getBoundingClientRect(); setO({x:((e.clientX-b.left)/b.width)*100,y:((e.clientY-b.top)/b.height)*100}); }}>
        <img src={url} alt={label} draggable={false}
          style={{maxWidth:'100%',maxHeight:'100%',transform:`scale(${z}) rotate(${rot}deg)`,transformOrigin:`${o.x}% ${o.y}%`,transition:'transform .12s'}}/>
      </div>
    </div>
  );
}

/* UIDAI certificates: needed for the "Instant verify with Aadhaar QR" route in the app.
   Download the current Secure QR / offline e-KYC signing certificate from uidai.gov.in
   (Developer section → UIDAI certificate details) and upload the .cer here. Until one is uploaded
   the app quietly uses the photo route only. */
function UidaiCerts(){
  const [list,setList]=useState<any[]|null>(null);
  const [busy,setBusy]=useState(false);
  async function load(){ const { data }=await supabase.rpc('admin_uidai_cert_list'); setList(data||[]); }
  useEffect(()=>{ load(); },[]);
  async function onFile(f:File){
    setBusy(true);
    try{
      const buf=new Uint8Array(await f.arrayBuffer());
      const text=new TextDecoder().decode(buf);
      let b64:string;
      if(text.includes('-----BEGIN')) b64=text.replace(/-----[^-]+-----/g,'').replace(/\s+/g,'');
      else { let s=''; buf.forEach(c=>{ s+=String.fromCharCode(c); }); b64=btoa(s); }
      const { error }=await supabase.rpc('admin_uidai_cert_set',{ p_name:f.name, p_der_b64:b64, p_active:true });
      if(error) toast(error.message); else load();
    } finally { setBusy(false); }
  }
  return (
    <div className="card">
      <div className="card-h">
        <h2><KeyRound size={16}/> Aadhaar QR instant verify</h2>
        <label className="btn ghost sm" style={{cursor:'pointer'}}>
          <Upload size={13}/> {busy?'Uploading…':'Upload UIDAI certificate'}
          <input type="file" accept=".cer,.crt,.pem,.der" style={{display:'none'}} disabled={busy}
            onChange={e=>{ const f=e.target.files?.[0]; if(f) onFile(f); e.currentTarget.value=''; }}/>
        </label>
      </div>
      <div style={{padding:'12px 18px',fontSize:13}}>
        {list===null ? <Loading/> : list.length===0
          ? <div className="muted">Off — no UIDAI certificate uploaded yet, so the app only offers the photo route. Download the Secure QR / Paperless Offline e-KYC signing certificate from uidai.gov.in → Developer section → UIDAI certificate details, then upload it here.</div>
          : <div>
              <div style={{marginBottom:6}}><span className="badge b-ok">On</span> Users can scan the QR on their Aadhaar for instant verification. Auto-approved only when the signature is valid, the Aadhaar mobile matches the account phone, the selfie passed the live check and the ID isn't on another account.</div>
              {list.map(c=><div key={c.name} className="muted">{c.name} · added {timeAgo(c.added_at)}{c.active?'':' · off'}</div>)}
            </div>}
      </div>
    </div>
  );
}
