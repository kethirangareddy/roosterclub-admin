import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Megaphone, Send, Clock, FlaskConical, Trash2 } from 'lucide-react';
import { Field, Empty, Loading, timeAgo } from '../ui';
import { STATES, districtsFor } from '../locations';

export default function Announcements(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [state,setState]=useState('');
  const [district,setDistrict]=useState('');
  const [kyc,setKyc]=useState(false);
  const [badge,setBadge]=useState(false);
  const [inactive,setInactive]=useState(false);
  const [when,setWhen]=useState(''); // datetime-local; empty = send now
  const [sending,setSending]=useState(false);

  async function load(){
    setLoading(true);
    const { data }=await supabase.from('announcements').select('*')
      .order('created_at',{ascending:false}).limit(50);
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  function regionLabel(r:any){
    if(r.district) return `${r.district}${r.state?', '+r.state:''}`;
    if(r.state) return r.state;
    return 'Everyone';
  }
  function targetLabel(r:any){
    const t=r.target||{};
    const bits=[t.kyc?'KYC':null,t.badge?'badge':null,t.inactive_days?`inactive ${t.inactive_days}d`:null].filter(Boolean);
    return bits.length?bits.join(' + '):null;
  }

  function payload(extra:any={}){
    return {
      title:title.trim(), body:body.trim(),
      state: state.trim()||undefined, district: district.trim()||undefined,
      kyc: kyc||undefined, badge: badge||undefined,
      inactive_days: inactive?30:undefined,
      ...extra,
    };
  }

  async function testSend(){
    if(!title.trim()||!body.trim()){ alert('Title and message are required.'); return; }
    setSending(true);
    const { data, error }=await supabase.functions.invoke('broadcast',{ body:payload({ test:true }) });
    setSending(false);
    if(error){ alert('Test failed: '+error.message); return; }
    alert(`Test sent to your ${(data as any)?.count ?? 0} device(s). Check your phone.`);
  }

  async function send(){
    if(!title.trim()||!body.trim()){ alert('Title and message are required.'); return; }
    const scheduled_at=when?new Date(when).toISOString():undefined;
    if(when && new Date(when).getTime()<=Date.now()){ alert('Schedule time is in the past — clear it to send now.'); return; }
    const reach=[
      district.trim()?`${district.trim()}, ${state.trim()}`:state.trim()||'EVERYONE',
      kyc?'KYC-verified only':null, badge?'badge holders only':null, inactive?'inactive 30d+ only':null,
    ].filter(Boolean).join(' · ');
    if(!confirm(scheduled_at
      ? `Schedule this announcement for ${new Date(when).toLocaleString('en-IN')} to ${reach}?`
      : `Send this announcement now to ${reach}?`)) return;
    setSending(true);
    const { data, error }=await supabase.functions.invoke('broadcast',{ body:payload({ scheduled_at }) });
    setSending(false);
    if(error){ alert('Could not send: '+error.message); return; }
    alert((data as any)?.scheduled ? 'Scheduled ✓ — the panel sends it automatically.' : `Sent to ${(data as any)?.count ?? 0} device(s).`);
    setTitle(''); setBody(''); setState(''); setDistrict(''); setKyc(false); setBadge(false); setInactive(false); setWhen('');
    load();
  }

  async function cancelScheduled(id:string){
    if(!confirm('Cancel this scheduled announcement?')) return;
    const { error }=await supabase.from('announcements').delete().eq('id',id).eq('status','scheduled');
    if(error){ alert(error.message); return; }
    load();
  }

  return (
    <>
      <h1 className="h1">Announcements</h1>
      <p className="sub">Push to everyone, or narrow by region, KYC, badge, or inactivity. Schedule for later (e.g. 6 PM) and test on your own phone first.</p>

      <div className="card">
        <div className="card-h"><h2><Megaphone size={16}/> New announcement</h2></div>
        <div style={{padding:16,display:'flex',flexDirection:'column',gap:12}}>
          <Field label="Title"><input style={{width:'100%'}} value={title} maxLength={80}
            onChange={e=>setTitle(e.target.value)} placeholder="e.g. New breeders joined near you"/></Field>
          <Field label="Message"><textarea rows={3} style={{width:'100%',resize:'vertical'}} value={body} maxLength={240}
            onChange={e=>setBody(e.target.value)} placeholder="Keep it short and useful — these go to everyone."/></Field>
          <div className="grid2">
            <Field label="State (optional)">
              <select style={{width:'100%'}} value={state} onChange={e=>{ setState(e.target.value); setDistrict(''); }}>
                <option value="">All states</option>
                {STATES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="District (optional)">
              <select style={{width:'100%'}} value={district} onChange={e=>setDistrict(e.target.value)} disabled={!state}>
                <option value="">{state ? 'Whole state' : 'Pick a state first'}</option>
                {districtsFor(state).map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:13}}>
            <label style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer'}}>
              <input type="checkbox" checked={kyc} onChange={e=>setKyc(e.target.checked)}/> KYC-verified only
            </label>
            <label style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer'}}>
              <input type="checkbox" checked={badge} onChange={e=>setBadge(e.target.checked)}/> Badge holders only
            </label>
            <label style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer'}}
              title="No listings and no chat messages in the last 30 days — a win-back nudge.">
              <input type="checkbox" checked={inactive} onChange={e=>setInactive(e.target.checked)}/> Inactive 30+ days only
            </label>
          </div>
          <div className="grid2">
            <Field label="Schedule (optional — leave empty to send now)">
              <input type="datetime-local" style={{width:'100%'}} value={when} onChange={e=>setWhen(e.target.value)}/>
            </Field>
            <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
              <button className="btn ghost" disabled={sending} onClick={testSend} title="Delivers only to your own devices — nothing is recorded.">
                <FlaskConical size={15}/> Test on my phone
              </button>
              <button className="btn" disabled={sending} onClick={send}>
                {when?<Clock size={15}/>:<Send size={15}/>} {sending?'Working…':when?'Schedule':'Send now'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <div className="card-h"><h2>Sent &amp; scheduled ({rows.length})</h2></div>
        {loading?<Loading/>:rows.length===0?<Empty text="No announcements yet."/>:(
          <table>
            <thead><tr><th>Title</th><th>Message</th><th>Reach</th><th>Status</th><th>Devices</th><th>When</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.title}</b></td>
                  <td className="muted" style={{maxWidth:280,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.body}</td>
                  <td className="muted">{regionLabel(r)}{targetLabel(r)?<div style={{fontSize:11}}>{targetLabel(r)}</div>:null}</td>
                  <td>{r.status==='scheduled'
                    ? <span className="badge b-info"><Clock size={11}/> {new Date(r.scheduled_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</span>
                    : <span className="badge b-ok">sent</span>}</td>
                  <td>{r.status==='scheduled'?<span className="muted">—</span>:<span className="badge b-ok">{r.recipients_count}</span>}</td>
                  <td className="muted">{timeAgo(r.sent_at||r.created_at)}</td>
                  <td>{r.status==='scheduled' &&
                    <button className="btn ghost sm" onClick={()=>cancelScheduled(r.id)}><Trash2 size={12}/> Cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
