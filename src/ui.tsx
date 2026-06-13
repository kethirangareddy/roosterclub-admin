import { ReactNode } from 'react';
import { X } from 'lucide-react';

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
