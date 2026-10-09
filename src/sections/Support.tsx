import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { Send, RefreshCw } from 'lucide-react';
import { Empty, Loading, timeAgo, UserLink } from '../ui';

// In-app "Rooster Club Team" chat (9 Oct 2026). Users write from the pinned row at the
// top of their Chats tab; replies here are saved and sent to their phone as a push.
export default function Support({ onChange }:{ onChange?:()=>void }){
  const [threads,setThreads]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [sel,setSel]=useState<string|null>(null);
  const [msgs,setMsgs]=useState<any[]>([]);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const endRef=useRef<HTMLDivElement>(null);

  async function loadThreads(){
    const { data, error }=await supabase.rpc('admin_support_threads',{ p_limit:200 });
    if(error) alert(error.message);
    setThreads(data||[]); setLoading(false);
  }
  async function loadThread(uid:string, markRead=false){
    const { data, error }=await supabase.from('support_messages')
      .select('id, from_admin, body, created_at').eq('user_id',uid)
      .order('created_at',{ ascending:true }).limit(500);
    if(error){ alert(error.message); return; }
    setMsgs(data||[]);
    setTimeout(()=>endRef.current?.scrollIntoView({block:'end'}),50);
    if(markRead){
      await supabase.rpc('admin_support_mark_read',{ p_user:uid });
      setThreads(ts=>ts.map(t=>t.user_id===uid?{...t,admin_unread:0}:t));
      onChange?.();
    }
  }
  useEffect(()=>{ loadThreads(); const t=setInterval(loadThreads,20000); return ()=>clearInterval(t); },[]);
  useEffect(()=>{ if(!sel) return; loadThread(sel,true); const t=setInterval(()=>loadThread(sel,true),10000); return ()=>clearInterval(t); },[sel]);

  const cur=threads.find(t=>t.user_id===sel);
  const nameOf=(t:any)=>t?.farm_name||t?.full_name||(t?.handle?'@'+t.handle:'User');

  async function send(){
    const text=draft.trim(); if(!sel||!text) return;
    setBusy(true);
    const { error }=await supabase.rpc('admin_support_reply',{ p_user:sel, p_body:text });
    setBusy(false);
    if(error){ alert('Reply failed: '+error.message); return; }
    setDraft('');
    loadThread(sel); loadThreads();
  }

  return (
    <>
      <h1 className="h1">Support</h1>
      <p className="sub">Messages people send to “Rooster Club Team” from the top of their Chats tab. Your reply reaches them in the app with a notification.</p>
      <div className="card" style={{display:'grid',gridTemplateColumns:'minmax(220px,320px) 1fr',minHeight:460,padding:0,overflow:'hidden'}}>
        <div style={{borderRight:'1px solid var(--line,#e5e0d3)',overflowY:'auto',maxHeight:620}}>
          <div className="card-h" style={{padding:'10px 12px'}}><h2>Conversations</h2>
            <button className="btn ghost sm" onClick={loadThreads} title="Refresh"><RefreshCw size={13}/></button></div>
          {loading?<Loading/>:threads.length===0?<Empty text="No messages yet."/>:threads.map(t=>(
            <div key={t.user_id} onClick={()=>setSel(t.user_id)}
              style={{padding:'10px 12px',cursor:'pointer',borderTop:'1px solid var(--line,#eee)',background:sel===t.user_id?'rgba(186,117,23,.10)':undefined}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                <b style={{fontSize:13.5}}>{nameOf(t)}</b>
                <span className="muted" style={{fontSize:11.5,whiteSpace:'nowrap'}}>{timeAgo(t.last_message_at)}</span>
              </div>
              <div className="muted" style={{fontSize:12.5,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {t.last_from_admin?'You: ':''}{t.last_message}
              </div>
              <div style={{display:'flex',gap:6,marginTop:3,alignItems:'center'}}>
                {Number(t.admin_unread)>0 && <span className="badge b-ok" style={{fontSize:10.5}}>{t.admin_unread} new</span>}
                {(t.district||t.state) && <span className="muted" style={{fontSize:11}}>{[t.district,t.state].filter(Boolean).join(', ')}</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',minWidth:0}}>
          {!sel?<div style={{margin:'auto'}} className="muted">Pick a conversation</div>:<>
            <div className="card-h" style={{padding:'10px 14px'}}>
              <h2 style={{fontSize:14}}><UserLink id={sel}><b>{nameOf(cur)}</b></UserLink>
                {cur?.handle && <span className="muted" style={{fontSize:12,marginLeft:8}}>@{cur.handle}</span>}</h2>
              {Number(cur?.user_unread)>0
                ? <span className="badge b-mut">They haven't read your last reply</span>
                : null}
            </div>
            <div style={{flex:1,overflowY:'auto',padding:14,maxHeight:480,background:'rgba(0,0,0,.02)'}}>
              {msgs.map(m=>(
                <div key={m.id} style={{display:'flex',justifyContent:m.from_admin?'flex-end':'flex-start',margin:'6px 0'}}>
                  <div style={{maxWidth:'75%',padding:'8px 11px',borderRadius:10,whiteSpace:'pre-wrap',fontSize:13.5,
                    background:m.from_admin?'#F6E7C8':'#fff',border:'1px solid rgba(0,0,0,.06)'}}>
                    {m.body}
                    <div className="muted" style={{fontSize:10.5,marginTop:3,textAlign:'right'}}>
                      {new Date(m.created_at).toLocaleString()}{m.from_admin?' · team':''}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef}/>
            </div>
            <div style={{display:'flex',gap:8,padding:10,borderTop:'1px solid var(--line,#eee)'}}>
              <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={2} disabled={busy} maxLength={2000}
                placeholder="Type a reply…"
                onKeyDown={e=>{ if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)) send(); }}
                style={{flex:1,resize:'vertical',padding:8,borderRadius:8,fontSize:13.5}}/>
              <button className="btn" disabled={busy||!draft.trim()} onClick={send}
                style={{display:'inline-flex',alignItems:'center',gap:5}}>
                <Send size={14}/>{busy?'Sending…':'Send'}</button>
            </div>
          </>}
        </div>
      </div>
    </>
  );
}
