import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { Send, RefreshCw } from 'lucide-react';
import { Empty, Loading, timeAgo, UserLink, WaIcon } from '../ui';

// WhatsApp inbox for 95153 69756 (MSG91 → wa-inbound webhook → wa_inbox).
// Replies go out ONLY when the admin presses Send, and only inside WhatsApp's
// 24-hour window after the customer's last message.
const DAY=24*3600*1000;

export default function WaInbox(){
  const [threads,setThreads]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [sel,setSel]=useState<string|null>(null);
  const [msgs,setMsgs]=useState<any[]>([]);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const endRef=useRef<HTMLDivElement>(null);

  async function loadThreads(){
    const { data, error }=await supabase.rpc('admin_wa_threads');
    if(error) alert(error.message);
    setThreads(data||[]); setLoading(false);
  }
  async function loadThread(n:string){
    const { data }=await supabase.rpc('admin_wa_thread',{ p_number:n });
    setMsgs(data||[]);
    setTimeout(()=>endRef.current?.scrollIntoView({block:'end'}),50);
  }
  useEffect(()=>{ loadThreads(); const t=setInterval(loadThreads,20000); return ()=>clearInterval(t); },[]);
  useEffect(()=>{ if(!sel) return; loadThread(sel); const t=setInterval(()=>loadThread(sel),10000); return ()=>clearInterval(t); },[sel]);

  const cur=threads.find(t=>t.customer_number===sel);
  const windowOpen=!!cur?.last_in_at && Date.now()-new Date(cur.last_in_at).getTime()<DAY;
  const hoursLeft=cur?.last_in_at?Math.max(0,Math.floor((DAY-(Date.now()-new Date(cur.last_in_at).getTime()))/3600000)):0;

  async function send(){
    const text=draft.trim(); if(!sel||!text) return;
    if(!confirm(`Send this WhatsApp reply to +${sel}?\n\n"${text.slice(0,200)}"`)) return;
    setBusy(true);
    const { data, error }=await supabase.functions.invoke('wa-send-template',{ body:{ reply_to:sel, text } });
    setBusy(false);
    if(error || !(data as any)?.ok){
      alert('Reply failed: '+((data as any)?.error||JSON.stringify((data as any)?.response||error?.message)).slice(0,400));
    } else setDraft('');
    loadThread(sel); loadThreads();
  }

  return (
    <>
      <h1 className="h1">WhatsApp Inbox</h1>
      <p className="sub">Messages people send to 95153 69756. You can reply for free within 24 hours of their last message. Nothing is sent unless you press Send.</p>
      <div className="card" style={{display:'grid',gridTemplateColumns:'minmax(220px,320px) 1fr',minHeight:460,padding:0,overflow:'hidden'}}>
        <div style={{borderRight:'1px solid var(--line,#e5e0d3)',overflowY:'auto',maxHeight:620}}>
          <div className="card-h" style={{padding:'10px 12px'}}><h2 style={{display:'flex',alignItems:'center',gap:6}}><WaIcon/> Chats</h2>
            <button className="btn ghost sm" onClick={loadThreads} title="Refresh"><RefreshCw size={13}/></button></div>
          {loading?<Loading/>:threads.length===0?<Empty text="No WhatsApp messages yet."/>:threads.map(t=>(
            <div key={t.customer_number} onClick={()=>setSel(t.customer_number)}
              style={{padding:'10px 12px',cursor:'pointer',borderTop:'1px solid var(--line,#eee)',background:sel===t.customer_number?'rgba(37,211,102,.08)':undefined}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                <b style={{fontSize:13.5}}>{t.full_name||t.customer_name||('+'+t.customer_number)}</b>
                <span className="muted" style={{fontSize:11.5,whiteSpace:'nowrap'}}>{timeAgo(t.last_at)}</span>
              </div>
              <div className="muted" style={{fontSize:12.5,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {t.last_direction==='out'?'You: ':''}{t.last_text||'[media]'}
              </div>
              {Number(t.unread_in)>0 && <span className="badge b-ok" style={{fontSize:10.5}}>{t.unread_in} new</span>}
            </div>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',minWidth:0}}>
          {!sel?<div style={{margin:'auto'}} className="muted">Pick a chat</div>:<>
            <div className="card-h" style={{padding:'10px 14px'}}>
              <h2 style={{fontSize:14}}>{cur?.user_id
                ? <UserLink id={cur.user_id}><b>{cur.full_name||cur.customer_name}</b></UserLink>
                : <b>{cur?.customer_name||'Not an app user'}</b>}
                <span className="muted" style={{fontFamily:'monospace',fontSize:12,marginLeft:8}}>+{sel}</span></h2>
              <span className={'badge '+(windowOpen?'b-ok':'b-mut')} title="WhatsApp only allows free-form replies within 24h of the customer's last message">
                {windowOpen?`Reply window: ${hoursLeft}h left`:'Reply window closed'}</span>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:14,maxHeight:480,background:'rgba(0,0,0,.02)'}}>
              {msgs.map(m=>(
                <div key={m.id} style={{display:'flex',justifyContent:m.direction==='out'?'flex-end':'flex-start',margin:'6px 0'}}>
                  <div style={{maxWidth:'75%',padding:'8px 11px',borderRadius:10,whiteSpace:'pre-wrap',fontSize:13.5,
                    background:m.direction==='out'?(m.status==='failed'?'#fde2e2':'#dcf8c6'):'#fff',border:'1px solid rgba(0,0,0,.06)'}}>
                    {m.text||`[${m.content_type||'media'}]`}
                    <div className="muted" style={{fontSize:10.5,marginTop:3,textAlign:'right'}}>
                      {new Date(m.created_at).toLocaleString()}{m.direction==='out'?(m.status==='failed'?' · failed':' · sent'):''}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef}/>
            </div>
            <div style={{display:'flex',gap:8,padding:10,borderTop:'1px solid var(--line,#eee)'}}>
              <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={2} disabled={!windowOpen||busy}
                placeholder={windowOpen?'Type a reply…':'24h window closed — they must message you first, or use an approved template'}
                style={{flex:1,resize:'vertical',padding:8,borderRadius:8,fontSize:13.5}}/>
              <button className="btn" disabled={!windowOpen||busy||!draft.trim()} onClick={send}
                style={{background:'#25D366',borderColor:'#25D366',color:'#fff',display:'inline-flex',alignItems:'center',gap:5}}>
                <Send size={14}/>{busy?'Sending…':'Send'}</button>
            </div>
          </>}
        </div>
      </div>
    </>
  );
}
