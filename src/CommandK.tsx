import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { Search, User, ListChecks, ReceiptText, Gavel, Flag } from 'lucide-react';

export type HitKind = 'user' | 'listing' | 'receipt' | 'auction' | 'report';
export type Hit = { kind: HitKind; id: string; title: string; subtitle: string; created_at: string };

const ICON: Record<HitKind, any> = { user: User, listing: ListChecks, receipt: ReceiptText, auction: Gavel, report: Flag };
const LABEL: Record<HitKind, string> = { user: 'Users', listing: 'Listings', receipt: 'Receipts', auction: 'Auctions', report: 'Reports' };

/** ⌘K / Ctrl+K palette — one box that finds any user, listing, receipt, auction or report. */
export default function CommandK({ onOpenResult, onClose }:{
  onOpenResult:(h:Hit)=>void; onClose:()=>void;
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

  function onKey(e:React.KeyboardEvent){
    if(e.key==='Escape'){ onClose(); }
    else if(e.key==='ArrowDown'){ e.preventDefault(); setSel(s=>Math.min(hits.length-1,s+1)); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); setSel(s=>Math.max(0,s-1)); }
    else if(e.key==='Enter' && hits[sel]){ onOpenResult(hits[sel]); }
  }

  // Group in fixed order, preserving flat index for arrow-key selection.
  const order:HitKind[]=['user','listing','receipt','auction','report'];
  const grouped=order.map(k=>({ kind:k, items:hits.filter(h=>h.kind===k) })).filter(g=>g.items.length>0);
  let flat=-1;

  return (
    <div className="scrim" style={{alignItems:'flex-start',paddingTop:'12vh'}} onClick={onClose}>
      <div className="cmdk" onClick={e=>e.stopPropagation()}>
        <div className="cmdk-in">
          <Search size={16} style={{color:'var(--muted)',flexShrink:0}}/>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search users, listings, receipts, auctions, reports…"/>
          {busy && <span className="muted" style={{fontSize:11}}>…</span>}
        </div>
        <div className="cmdk-body">
          {q.trim().length<2
            ? <div className="cmdk-hint">Type at least 2 characters — name, @handle, phone, breed, receipt no, verify code…</div>
            : hits.length===0 && !busy
            ? <div className="cmdk-hint">No matches for “{q.trim()}”.</div>
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
