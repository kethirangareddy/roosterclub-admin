import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { Search, User, ListChecks, ReceiptText, Gavel, Flag, Megaphone, ShieldCheck,
  Award, Repeat, MapPin, Activity as ActivityIcon, Wallet, SlidersHorizontal, Inbox, MessageSquare } from 'lucide-react';

export type HitKind = 'user' | 'listing' | 'receipt' | 'auction' | 'report';
export type Hit = { kind: HitKind; id: string; title: string; subtitle: string; created_at: string };

const ICON: Record<HitKind, any> = { user: User, listing: ListChecks, receipt: ReceiptText, auction: Gavel, report: Flag };
const LABEL: Record<HitKind, string> = { user: 'Users', listing: 'Listings', receipt: 'Receipts', auction: 'Auctions', report: 'Reports' };

/* The palette used to find records only. Half of what you want at 6am is a
   *place to act*, not a row — so commands come first and show with an empty box. */
type Action = { id:string; label:string; hint:string; view:string; qp?:Record<string,string>; Icon:any };
const ACTIONS: Action[] = [
  { id:'announce',  label:'Send an announcement',      hint:'push to a state, district or segment', view:'announce',  Icon:Megaphone },
  { id:'approvals', label:'Review pending listings',   hint:'approve / reject queue',               view:'approvals', Icon:Inbox },
  { id:'kyc',       label:'Review KYC',                hint:'verification queue',                   view:'kyc',       Icon:ShieldCheck },
  { id:'badges',    label:'Review badge requests',     hint:'decide seller badges',                 view:'badges',    Icon:Award },
  { id:'retention', label:'Retention & activation',    hint:'did yesterday’s signups come back?',   view:'analytics', qp:{tab:'cohorts'},   Icon:Repeat },
  { id:'funnel',    label:'Funnel health',             hint:'ignored chats, listings with no reply',view:'analytics', qp:{tab:'funnel'},    Icon:MessageSquare },
  { id:'gaps',      label:'Supply gaps by district',   hint:'buyers with nothing to buy',           view:'analytics', qp:{tab:'liquidity'}, Icon:MapPin },
  { id:'money',     label:'Money desk',                hint:'spend, cost per signup, receipts',     view:'money',     Icon:Wallet },
  { id:'activity',  label:'Admin activity log',        hint:'what did I change, and when',          view:'activity',  Icon:ActivityIcon },
  { id:'config',    label:'App config / feature flags',hint:'change the app with no rebuild',       view:'appconfig', Icon:SlidersHorizontal },
];

/** ⌘K / Ctrl+K palette — commands plus any user, listing, receipt, auction or report. */
export default function CommandK({ onOpenResult, onGo, onClose }:{
  onOpenResult:(h:Hit)=>void; onGo:(view:string,qp?:Record<string,string>)=>void; onClose:()=>void;
}){
  const [q,setQ]=useState('');
  const [hits,setHits]=useState<Hit[]>([]);
  const [sel,setSel]=useState(0);
  const [busy,setBusy]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);
  const seq=useRef(0);

  useEffect(()=>{ inputRef.current?.focus(); },[]);

  // Debounced search — one RPC hits all five tables.
  useEffect(()=>{
    const term=q.trim();
    if(term.length<2){ setHits([]); setSel(0); return; }
    setBusy(true);
    const mine=++seq.current;
    const t=setTimeout(async()=>{
      const { data, error }=await supabase.rpc('admin_search',{ q:term });
      if(mine!==seq.current) return; // a newer keystroke superseded this query
      setBusy(false);
      if(error){ console.error(error); return; }
      setHits((data||[]) as Hit[]); setSel(0);
    },220);
    return ()=>clearTimeout(t);
  },[q]);

  const term=q.trim().toLowerCase();
  const acts=term
    ? ACTIONS.filter(a=>(a.label+' '+a.hint).toLowerCase().includes(term))
    : ACTIONS;
  const total=acts.length+hits.length;

  function run(i:number){
    if(i<acts.length){ const a=acts[i]; onGo(a.view,a.qp); return; }
    const h=hits[i-acts.length];
    if(h) onOpenResult(h);
  }

  function onKey(e:React.KeyboardEvent){
    if(e.key==='Escape'){ onClose(); }
    else if(e.key==='ArrowDown'){ e.preventDefault(); setSel(s=>Math.min(total-1,s+1)); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); setSel(s=>Math.max(0,s-1)); }
    else if(e.key==='Enter'){ e.preventDefault(); run(sel); }
  }

  // Group in fixed order, preserving flat index for arrow-key selection.
  const order:HitKind[]=['user','listing','receipt','auction','report'];
  const grouped=order.map(k=>({ kind:k, items:hits.filter(h=>h.kind===k) })).filter(g=>g.items.length>0);
  let flat=acts.length-1;

  return (
    <div className="scrim" style={{alignItems:'flex-start',paddingTop:'12vh'}} onClick={onClose}>
      <div className="cmdk" onClick={e=>e.stopPropagation()}>
        <div className="cmdk-in">
          <Search size={16} style={{color:'var(--muted)',flexShrink:0}}/>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Run a command, or find a user, listing, receipt…"/>
          {busy && <span className="muted" style={{fontSize:11}}>…</span>}
        </div>
        <div className="cmdk-body">
          {acts.length>0 && (
            <div>
              <div className="cmdk-group">Actions</div>
              {acts.map((a,i)=>(
                <div key={a.id} className={'cmdk-row'+(i===sel?' on':'')}
                  onMouseEnter={()=>setSel(i)} onClick={()=>run(i)}>
                  <a.Icon size={15} style={{color:'var(--iris,#7B3F00)',flexShrink:0}}/>
                  <div style={{minWidth:0}}>
                    <div className="cmdk-t">{a.label}</div>
                    <div className="cmdk-s">{a.hint}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {q.trim().length<2
            ? <div className="cmdk-hint">…or type at least 2 characters to find a name, @handle, phone, breed, receipt no, verify code.</div>
            : hits.length===0 && !busy
            ? <div className="cmdk-hint">No records match “{q.trim()}”.</div>
            : grouped.map(g=>(
                <div key={g.kind}>
                  <div className="cmdk-group">{LABEL[g.kind]}</div>
                  {g.items.map(h=>{
                    flat++;
                    const i=flat, Icon=ICON[h.kind];
                    return (
                      <div key={h.kind+h.id} className={'cmdk-row'+(i===sel?' on':'')}
                        onMouseEnter={()=>setSel(i)} onClick={()=>onOpenResult(h)}>
                        <Icon size={15} style={{color:'var(--cta)',flexShrink:0}}/>
                        <div style={{minWidth:0}}>
                          <div className="cmdk-t">{h.title}</div>
                          <div className="cmdk-s">{h.subtitle}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
        </div>
        <div className="cmdk-foot">↑↓ navigate · Enter open · Esc close</div>
      </div>
    </div>
  );
}
