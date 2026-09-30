import { useEffect, useState } from 'react';
import { supabase, adminPhones } from '../supabase';
import { Award, Check, X, Send } from 'lucide-react';
import { Empty, Loading, timeAgo, WaButton, WaIcon, FOUNDER_CAP, UserLink, Copyable } from '../ui';

// WhatsApp API template (MSG91). Sent ONLY when the admin presses a button — never automatically.
const WA_TEMPLATE='badge_invite_earn';
const WA_COST=1.02; // ≈ ₹ per marketing message incl. GST

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
      .select('*, user:users!badge_requests_user_id_fkey(full_name,handle,badge,state,district,language)')
      .order('created_at',{ascending:false}).limit(100);
    if(tab==='pending') q=q.eq('status','pending');
    const { data,error }=await q;
    if(error){ alert(error.message); }
    const list=data||[];
    const phones=await adminPhones(list.map((r:any)=>r.user_id));
    setRows(list.map((r:any)=>({...r, user:r.user?{...r.user, phone:phones[r.user_id]||null}:r.user}))); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  // Founder's Badge counter — capped at 100 by trg_founder_badge_cap in the DB.
  const [founders,setFounders]=useState<{issued:number;remaining:number}|null>(null);
  async function loadFounders(){
    const { data }=await supabase.rpc('founder_badge_stats');
    const f=Array.isArray(data)?data[0]:data;
    if(f) setFounders({ issued:f.issued, remaining:f.remaining });
  }
  useEffect(()=>{ loadFounders(); },[]);

  // ---- WhatsApp "Invite & Earn" (MSG91 API) — manual send only ----
  const [waSent,setWaSent]=useState<Record<string,{status:string;created_at:string;error?:string}>>({});
  const [waBusy,setWaBusy]=useState<string|null>(null); // user_id being sent, or 'bulk'/'test'
  async function loadWa(){
    const { data }=await supabase.rpc('admin_wa_sends',{ p_template:WA_TEMPLATE });
    const m:Record<string,any>={}; (data||[]).forEach((r:any)=>{ m[r.user_id]=r; });
    setWaSent(m);
  }
  useEffect(()=>{ loadWa(); },[]);
  async function waSend(ids:string[], busyKey:string, resend=false){
    setWaBusy(busyKey);
    const { data, error }=await supabase.functions.invoke('wa-send-template',{ body:{ template:WA_TEMPLATE, user_ids:ids, resend } });
    setWaBusy(null);
    if(error || (data as any)?.error){ alert('WhatsApp send failed: '+((data as any)?.error||error?.message)); loadWa(); return; }
    const d=data as any;
    alert(`WhatsApp invite — sent: ${d.sent}, failed: ${d.failed}, skipped: ${d.skipped}`+
      (d.failed? '\n\nFirst error: '+(d.results.find((x:any)=>x.status==='failed')?.error||''):''));
    loadWa();
  }
  function waSendOne(r:any, resend=false){
    const name=r.user?.full_name||'this user';
    if(!confirm(`Send the WhatsApp "Invite & Earn" message to ${name}?\n\nCost ≈ ₹${WA_COST.toFixed(2)}`)) return;
    waSend([r.user_id], r.user_id, resend);
  }
  async function waSendTest(){
    const to=prompt('Send a TEST message to which WhatsApp number? (your own)','9515369756');
    if(!to) return;
    const lang=confirm('Send the Telugu version? (Cancel = English)')?'te':'en';
    setWaBusy('test');
    const { data, error }=await supabase.functions.invoke('wa-send-template',{ body:{ template:WA_TEMPLATE, test_to:to, test_lang:lang } });
    setWaBusy(null);
    if(error || !(data as any)?.ok) alert('Test failed: '+JSON.stringify((data as any)?.response||(data as any)?.error||error?.message).slice(0,400));
    else alert('Test sent — check WhatsApp on '+to);
  }

  async function approve(r:any){
    const badge=pick[r.id]||r.user?.badge||'bronze';
    if(badge==='founding_member' && founders && founders.remaining===0){
      alert(`All ${FOUNDER_CAP} Founder's Badges have been issued — pick a different badge.`);
      return;
    }
    if(!confirm(`Give ${r.user?.full_name||'this user'} the ${badge} badge?`)) return;
    // badge_source:'admin' protects this badge from the nightly earned-badge cron (it only recomputes non-admin badges).
    const u=await supabase.from('users').update({ badge, badge_source:'admin', badge_awarded_at:new Date().toISOString() }).eq('id',r.user_id);
    if(u.error){
      alert(/cap reached/i.test(u.error.message)
        ? `All ${FOUNDER_CAP} Founder's Badges have been issued — pick a different badge.`
        : u.error.message);
      loadFounders();
      return;
    }
    loadFounders();
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
  const unsentIds = Array.from(new Set(shown.filter(r=>r.user?.phone && waSent[r.user_id]?.status!=='sent').map(r=>r.user_id))).slice(0,100);
  function waSendAll(){
    if(unsentIds.length===0){ alert('Everyone shown has already been sent the invite.'); return; }
    if(!confirm(`Send the WhatsApp "Invite & Earn" message to ${unsentIds.length} people shown here who haven't received it yet?\n\nEstimated cost ≈ ₹${Math.ceil(unsentIds.length*WA_COST)}\n\nThis cannot be undone.`)) return;
    waSend(unsentIds,'bulk');
  }

  return (
    <>
      <h1 className="h1">Badge Requests</h1>
      <p className="sub">Users asking to be reviewed for a badge. Call them to confirm, pick a badge, then Approve — or Reject.</p>
      <div className="card">
        <div className="card-h">
          <h2><Award size={16}/> Requests{pending>0 && <span className="badge b-warn" style={{marginLeft:8}}>{pending} pending</span>}
            {founders && <span className={'badge '+(founders.remaining===0?'b-danger':founders.remaining<=10?'b-warn':'b-ok')}
              style={{marginLeft:8,fontWeight:500}}
              title={`Founder's Badge is capped at ${FOUNDER_CAP} in the database`}>
              Founder's: {founders.issued}/{FOUNDER_CAP} · {founders.remaining} left
            </span>}</h2>
          <div className="row-acts">
            <button className="btn ghost sm" disabled={!!waBusy} onClick={waSendTest} title="Send the invite template to your own number first">
              {waBusy==='test'?'Sending…':'Test to me'}</button>
            <button className="btn sm" style={{background:'#25D366',borderColor:'#25D366',color:'#fff',display:'inline-flex',alignItems:'center',gap:5}}
              disabled={!!waBusy} onClick={waSendAll} title="Send the Invite & Earn WhatsApp message to everyone shown who hasn't got it">
              <Send size={13}/>{waBusy==='bulk'?'Sending…':`Send invite (${unsentIds.length})`}</button>
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
            <thead><tr><th>User</th><th>Phone</th><th></th><th>Invite</th><th>Current</th><th>Status</th><th>When</th><th>Assign</th><th></th></tr></thead>
            <tbody>
              {shown.map(r=>(
                <tr key={r.id}>
                  <td><UserLink id={r.user_id}><b>{r.user?.full_name||('@'+(r.user?.handle||'user'))}</b></UserLink></td>
                  <td className="muted" style={{fontFamily:'monospace',fontSize:12.5,whiteSpace:'nowrap'}}>
                    <Copyable value={r.user?.phone} title="Copy phone number"/>
                    {r.user?.language==='te' && <span className="badge b-mut" style={{marginLeft:6,fontSize:10}}>తె</span>}
                  </td>
                  <td><WaButton phone={r.user?.phone} lang={r.user?.language}/></td>
                  <td style={{whiteSpace:'nowrap'}}>{(()=>{
                    const w=waSent[r.user_id];
                    if(w?.status==='sent') return <span className="badge b-ok" title={'Sent '+new Date(w.created_at).toLocaleString()}>✓ Sent {timeAgo(w.created_at)}</span>;
                    if(!r.user?.phone) return <span className="muted">—</span>;
                    return <button className="btn ghost sm" style={{color:'#25D366',display:'inline-flex',alignItems:'center',gap:5}}
                      disabled={!!waBusy} onClick={()=>waSendOne(r)}
                      title={w?.status==='failed'?('Last attempt failed: '+(w.error||'')):'Send the Invite & Earn WhatsApp message'}>
                      <WaIcon/>{waBusy===r.user_id?'Sending…':w?.status==='failed'?'Retry':w?.status==='skipped'?'Skipped · retry':'Send'}</button>;
                  })()}</td>
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
