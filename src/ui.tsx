import { ReactNode, useEffect, useRef, useState } from 'react';
import { X, Check, Copy } from 'lucide-react';
import { useDetail } from './detail';

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
      // Enter opens the focused row's detail view — keyboard parity with tapping.
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

/* ---------- tappable entities ----------
   Anywhere a row mentions a user / listing / receipt, wrap the label in one of
   these instead of printing bare text. They stop propagation so they stay safe
   inside rows that already have their own click handler, and they degrade to
   plain muted text when the id is missing (deleted seller, anonymous report…). */
function stop(e:React.MouseEvent){ e.stopPropagation(); }

export function UserLink({ id, children, title }:{
  id?:string|null; children?:ReactNode; title?:string;
}){
  const { openUser }=useDetail();
  const label=children ?? '—';
  if(!id) return <span className="muted">{label}</span>;
  return (
    <button type="button" className="linkbtn" title={title??'Open user 360'}
      onClick={e=>{ stop(e); openUser(id); }}>{label}</button>
  );
}

export function ListingLink({ id, children, title }:{
  id?:string|null; children?:ReactNode; title?:string;
}){
  const { openListing }=useDetail();
  const label=children ?? '—';
  if(!id) return <span className="muted">{label}</span>;
  return (
    <button type="button" className="linkbtn" title={title??'Open listing 360'}
      onClick={e=>{ stop(e); openListing(id); }}>{label}</button>
  );
}

export function ReceiptLink({ id, children, title }:{
  id?:string|null; children?:ReactNode; title?:string;
}){
  const { openReceipt }=useDetail();
  const label=children ?? '—';
  if(!id) return <span className="muted">{label}</span>;
  return (
    <button type="button" className="linkbtn" title={title??'Open receipt 360'}
      onClick={e=>{ stop(e); openReceipt(id); }}>{label}</button>
  );
}

/** Listing thumbnail that opens the listing. Falls back to a plain tile. */
export function ListingThumb({ id, src, alt }:{ id?:string|null; src?:string|null; alt?:string }){
  const { openListing }=useDetail();
  const img=<img className="thumb" src={src||''} alt={alt||''} loading="lazy"
    onError={e=>{ (e.currentTarget as HTMLImageElement).style.visibility='hidden'; }}/>;
  if(!id||!src) return src?img:<div className="thumb"/>;
  return (
    <button type="button" className="thumbbtn" title="Open listing 360"
      onClick={e=>{ stop(e); openListing(id); }}>{img}</button>
  );
}

/** Click to copy — ids, receipt numbers, phone numbers. Shows a ✓ for a beat. */
export function Copyable({ value, children, mono=true, title }:{
  value?:string|null; children?:ReactNode; mono?:boolean; title?:string;
}){
  const [done,setDone]=useState(false);
  const t=useRef<any>(null);
  useEffect(()=>()=>clearTimeout(t.current),[]);
  if(!value) return <span className="muted">{children??'—'}</span>;
  async function copy(e:React.MouseEvent){
    stop(e);
    try{ await navigator.clipboard.writeText(value!); }
    catch{
      // Clipboard API needs a secure context; fall back to the old trick.
      const ta=document.createElement('textarea');
      ta.value=value!; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); } finally { document.body.removeChild(ta); }
    }
    setDone(true); clearTimeout(t.current); t.current=setTimeout(()=>setDone(false),1200);
  }
  return (
    <button type="button" className={'copybtn'+(mono?' mono':'')+(done?' done':'')}
      onClick={copy} title={title??`Copy ${value}`}>
      {children??value}
      {done ? <Check size={12}/> : <Copy size={12} className="copyi"/>}
    </button>
  );
}

/** Short id for display — full value still lands on the clipboard. */
export function shortId(id?:string|null){ return id?String(id).slice(0,8):'—'; }

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

/* ---------- Founder's Badge outreach ----------
   The badge is promised to the first 100 members only; the DB trigger
   trg_founder_badge_cap enforces that, this is just the number to show. */
export const FOUNDER_CAP = 100;

/** Pre-filled WhatsApp copy, keyed by users.language. Anything that isn't
    Telugu falls back to English (live data: en 104, te 77, kn 1, hi 1).
    *asterisks* render as bold inside WhatsApp. */
const FOUNDER_MSG: Record<string, string> = {
  en: `🐓 Welcome to Rooster Club!

Special offer — *only for our first 100 members.*

Invite 10 people to Rooster Club and you'll earn the *Founder's Badge* — a permanent mark of respect on your profile that nobody joining later can ever get.

How:
Open the app → *Profile* → *Invite & Earn* → share your invite link

Once 10 people join with your link, the badge is yours.

Only 100 Founder's Badges will ever exist. Don't miss it.`,

  te: `🐓 రూస్టర్ క్లబ్‌కి స్వాగతం!

ప్రత్యేక ఆఫర్ — *మొదటి 100 మంది సభ్యులకు మాత్రమే.*

రూస్టర్ క్లబ్‌కి 10 మందిని ఆహ్వానించండి — *ఫౌండర్స్ బ్యాడ్జ్* మీ ప్రొఫైల్‌పై శాశ్వతంగా ఉంటుంది. తర్వాత చేరేవారికి ఇది ఎప్పటికీ దొరకదు.

ఎలా:
యాప్ ఓపెన్ చేయండి → *ప్రొఫైల్* → *Invite & Earn* → మీ ఇన్‌వైట్ లింక్ షేర్ చేయండి

మీ లింక్ ద్వారా 10 మంది చేరగానే బ్యాడ్జ్ మీదే.

మొత్తం 100 ఫౌండర్స్ బ్యాడ్జ్‌లు మాత్రమే. మిస్ చేసుకోకండి.`,
};

/** wa.me needs a bare international number: no +, no spaces, no leading zero.
    Stored numbers are a mix of "9876543210" and "+919876543210". */
export function waNumber(phone?: string | null){
  if(!phone) return null;
  let d = String(phone).replace(/\D/g, '').replace(/^0+/, '');
  if(d.length === 10) d = '91' + d;            // bare Indian mobile
  return d.length >= 11 && d.length <= 15 ? d : null;
}

export function waLink(phone?: string | null, lang?: string | null){
  const n = waNumber(phone);
  if(!n) return null;
  const msg = FOUNDER_MSG[lang === 'te' ? 'te' : 'en'];
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}

/** WhatsApp glyph — lucide dropped brand icons, so this is inline. */
export function WaIcon({ size = 14 }: { size?: number }){
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z"/>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z"/>
    </svg>
  );
}

/** Opens WhatsApp with the Founder's Badge message already typed — you just hit send. */
export function WaButton({ phone, lang, label }:{ phone?:string|null; lang?:string|null; label?:string }){
  const href = waLink(phone, lang);
  if(!href) return <span className="muted" title="No usable phone number">—</span>;
  return (
    <a className="btn ghost sm" href={href} target="_blank" rel="noopener noreferrer"
       style={{ color:'#25D366', display:'inline-flex', alignItems:'center', gap:5 }}
       title={`Open WhatsApp with the Founder's Badge message ready to send (${lang === 'te' ? 'Telugu' : 'English'})`}>
      <WaIcon/>{label ?? 'WhatsApp'}
    </a>
  );
}
