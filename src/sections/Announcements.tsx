import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Megaphone, Send } from 'lucide-react';
import { Field, Empty, Loading, timeAgo } from '../ui';
import { STATES, districtsFor } from '../locations';

export default function Announcements(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [state,setState]=useState('');
  const [district,setDistrict]=useState('');
  const [sending,setSending]=useState(false);

  async function load(){
    setLoading(true);
    const { data }=await supabase.from('announcements').select('*').order('created_at',{ascending:false}).limit(50);
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  function regionLabel(r:any){
    if(r.district) return `${r.district}${r.state?', '+r.state:''}`;
    if(r.state) return r.state;
    return 'Everyone';
  }

  async function send(){
    if(!title.trim()||!body.trim()){ alert('Title and message are required.'); return; }
    const reach = district.trim() ? `${district.trim()}${state.trim()?', '+state.trim():''}`
                : state.trim() ? state.trim() : 'EVERYONE';
    if(!confirm(`Send this announcement to ${reach}? It will be delivered to all of their devices.`)) return;
    setSending(true);
    const { data, error }=await supabase.functions.invoke('broadcast',{
      body:{ title:title.trim(), body:body.trim(),
             state: state.trim()||undefined, district: district.trim()||undefined },
    });
    setSending(false);
    if(error){ alert('Could not send: '+error.message); return; }
    alert(`Sent to ${ (data as any)?.count ?? 0 } device(s).`);
    setTitle(''); setBody(''); setState(''); setDistrict('');
    load();
  }

  return (
    <>
      <h1 className="h1">Announcements</h1>
      <p className="sub">Send a push notification to everyone, or narrow it to a state/district. Always delivered (users can only mute chat notifications).</p>

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
          <div className="muted" style={{fontSize:12}}>Tip: leave both blank to reach all users. District requires a State.</div>
          <div>
            <button className="btn" disabled={sending} onClick={send}>
              <Send size={15}/> {sending?'Sending…':'Send announcement'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <div className="card-h"><h2>Sent ({rows.length})</h2></div>
        {loading?<Loading/>:rows.length===0?<Empty text="No announcements sent yet."/>:(
          <table>
            <thead><tr><th>Title</th><th>Message</th><th>Reach</th><th>Devices</th><th>Sent</th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.title}</b></td>
                  <td className="muted" style={{maxWidth:320,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.body}</td>
                  <td className="muted">{regionLabel(r)}</td>
                  <td><span className="badge b-ok">{r.recipients_count}</span></td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
