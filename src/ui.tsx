import { ReactNode, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/* ---------- saved views: filter/tab state lives in the querystring ----------
   Bookmark ?view=kyc&tab=all and the panel reopens exactly there. */
export function getParam(key:string){ return new URLSearchParams(location.search).get(key); }
export function setParam(key:string, val:string|null, push=false){
  const u=new URL(location.href);
  if(val==null) u.searchParams.delete(key); else u.searchParams.set(key,val);
  if(push) history.pushState(null,'',u); else history.replaceState(null,'',u);
}
/** Tab/filter state mirrored to ?key= — bookmarkable, back/forward safe. */
export function useParamState<T extends string>(key:string, initial:T){
  const [val,setVal]=useState<T>((getParam(key) as T)||initial);
  useEffect(()=>{ setParam(key, val===initial?null:val); },[val]);
  useEffect(()=>{
    const onPop=()=>setVal((getParam(key) as T)||initial);
    window.addEventListener('popstate',onPop);
    return ()=>{ window.removeEventListener('popstate',onPop); };
  },[]);
  return [val,setVal] as const;
}

/* ---------- keyboard shortcuts on queue rows ----------
   j/k (or arrows) move the focused row; letter keys act on it (a approve, r reject…). */
export function keysBlocked(e:KeyboardEvent){
  const t=e.target as HTMLElement|null;
  return e.metaKey||e.ctrlKey||e.altKey
    || !!(t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))
    || !!document.querySelector('.scrim'); // a modal is open
}
export function useRowKeys(count:number, actions:Record<string,(i:number)=>void>){
  const [sel,setSel]=useState(-1);
  const ref=useRef({sel,count,actions});
  ref.current={sel,count,actions};
  useEffect(()=>{
    function onKey(e:KeyboardEvent){
      if(keysBlocked(e)) return;
      if((window as any).__gnav) return; // 'g' navigation sequence owns the next key
      const { sel,count,actions }=ref.current;
      if(count===0) return;
      if(e.key==='j'||e.key==='ArrowDown'){ e.preventDefault(); setSel(Math.min(count-1, sel<0?0:sel+1)); }
      else if(e.key==='k'||e.key==='ArrowUp'){ e.preventDefault(); setSel(Math.max(0, sel<0?0:sel-1)); }
      else if(e.key==='Escape'){ setSel(-1); }
      else if(actions[e.key] && sel>=0 && sel<count){ e.preventDefault(); actions[e.key](sel); }
    }
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[]);
  // Clamp when the list shrinks (e.g. after approving the last row).
  useEffect(()=>{ if(sel>=count) setSel(count-1); },[count]);
  return [sel,setSel] as const;
}

export function Modal({ title, onClose, children, footer }:{
  title:string; onClose:()=>void; children:ReactNode; footer?:ReactNode;
}){
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">{title}<button className="x" onClick={onClose}><X size={20}/></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }:{ label:string; children:ReactNode }){
  return <div><label>{label}</label>{children}</div>;
}

export function Empty({ text }:{ text:string }){ return <div className="empty">{text}</div>; }
export function Loading(){ return <div className="loading">Loading…</div>; }

export function timeAgo(iso?:string|null){
  if(!iso) return '—';
  const s=Math.floor((Date.now()-new Date(iso).getTime())/1000);
  if(s<60) return 'just now';
  const m=Math.floor(s/60); if(m<60) return m+'m ago';
  const h=Math.floor(m/60); if(h<24) return h+'h ago';
  const d=Math.floor(h/24); return d+'d ago';
}
export function loc(r:{village?:string|null;mandal?:string|null;district?:string|null;state?:string|null}){
  return [r.village,r.mandal,r.district,r.state].filter(Boolean).join(', ')||'—';
}
export function inr(n?:number|null){ return n==null?'—':'₹'+n.toLocaleString('en-IN'); }
