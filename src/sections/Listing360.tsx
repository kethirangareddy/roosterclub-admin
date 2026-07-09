import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Modal, timeAgo, inr } from '../ui';
import { Check, X, Star, Trash2, User, Eye, MessagesSquare, ReceiptText, Rocket } from 'lucide-react';

/** Listing-360 — everything about one listing + approve/reject/feature/delete, from anywhere. */
export default function Listing360({ listingId, onClose, onOpenUser, onChanged }:{
  listingId:string; onClose:()=>void; onOpenUser?:(userId:string)=>void; onChanged?:()=>void;
}){
  const [d,setD]=useState<any|null>(null);
  const [busy,setBusy]=useState(false);

  function load(){
    supabase.rpc('admin_listing_overview',{ p_listing:listingId })
      .then(({data,error})=>setD(error?{__error:error.message}:(data??{})));
  }
  useEffect(load,[listingId]);

  const l=d?.listing;
  async function setApproval(approval_status:string){
    setBusy(true);
    const { error }=await supabase.from('listings').update({ approval_status }).eq('id',listingId);
    setBusy(false);
    if(error){ alert(error.message); return; }
    load(); onChanged?.();
  }
  async function feature(days:number|null){
    setBusy(true);
    const featured_until=days?new Date(Date.now()+days*864e5).toISOString():null;
    const { error }=await supabase.from('listings').update({ featured_until }).eq('id',listingId);
    setBusy(false);
    if(error){ alert(error.message); return; }
    load();
  }
  // Item 16 — soft delete with a 30-day undo window (purge cron hard-deletes after 30d).
  async function remove(){
    if(!confirm('Remove this listing from the app? You can restore it for 30 days.')) return;
    const { error }=await supabase.from('listings')
      .update({ status:'removed', removed_at:new Date().toISOString() }).eq('id',listingId);
    if(error){ alert(error.message); return; }
    load(); onChanged?.();
  }
  async function restore(){
    const { error }=await supabase.from('listings')
      .update({ status:'active', removed_at:null }).eq('id',listingId);
    if(error){ alert(error.message); return; }
    load(); onChanged?.();
  }

  const boosted=l && l.boost_level>0 && l.boost_expires_at && new Date(l.boost_expires_at)>new Date();
  const featured=l && l.featured_until && new Date(l.featured_until)>new Date();

  return (
    <Modal title={l?`${l.breed||'Listing'} · ${inr(l.price)}`:'Loading…'} onClose={onClose}>
      {!d ? <div className="loading">Loading…</div>
        : d.__error ? <div className="empty">Could not load listing: {d.__error}</div>
        : !l ? <div className="empty">Listing not found (deleted?).</div> : (
        <>
          {/* media strip */}
          {(d.media||[]).length>0 && (
            <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
              {d.media.map((m:any,i:number)=>m.type==='video'
                ? <video key={i} src={m.url} poster={m.poster||undefined} controls style={{height:110,borderRadius:10,background:'#000'}}/>
                : <a key={i} href={m.url} target="_blank" rel="noreferrer">
                    <img src={m.url} style={{height:110,borderRadius:10,border:'1px solid var(--line)'}}/>
                  </a>)}
            </div>
          )}

          {/* status badges */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <span className={'badge '+(l.approval_status==='approved'?'b-ok':l.approval_status==='rejected'?'b-danger':'b-warn')}>{l.approval_status}</span>
            <span className="badge b-mut">{l.status}</span>
            <span className="badge b-mut">{l.type}</span>
            {boosted && <span className="badge b-info"><Rocket size={11}/> boost L{l.boost_level} → {timeAgo(l.boost_expires_at).replace(' ago','')}</span>}
            {featured && <span className="badge b-info"><Star size={11}/> featured until {new Date(l.featured_until).toLocaleDateString('en-IN')}</span>}
            {l.expires_at && <span className="badge b-mut">expires {new Date(l.expires_at).toLocaleDateString('en-IN')}</span>}
          </div>

          {/* seller */}
          <div style={{background:'var(--glass)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
            <div style={{fontSize:13}}>
              <b>{d.seller?.full_name||'—'}</b>{d.seller?.kyc && <span className="badge b-ok" style={{marginLeft:6}}>KYC</span>}{d.seller?.banned && <span className="badge b-danger" style={{marginLeft:6}}>banned</span>}
              <div className="muted" style={{fontSize:12}}>{d.seller?.handle?'@'+d.seller.handle+' · ':''}{d.seller?.phone||''} · {[d.seller?.district,d.seller?.state].filter(Boolean).join(', ')||'—'}</div>
            </div>
            {onOpenUser && d.seller?.id && <button className="btn ghost sm" onClick={()=>onOpenUser(d.seller.id)}><User size={13}/> Seller 360</button>}
          </div>

          {/* numbers */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[{lab:'Views',val:l.view_count??0,Icon:Eye},{lab:'Chats',val:d.chats??0,Icon:MessagesSquare},{lab:'Receipts',val:(d.receipts||[]).length,Icon:ReceiptText}].map(s=>(
              <div key={s.lab} style={{background:'var(--glass)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px'}}>
                <div style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',display:'flex',gap:5,alignItems:'center'}}><s.Icon size={12}/> {s.lab}</div>
                <div style={{fontWeight:700,fontSize:16,marginTop:3}}>{s.val}</div>
              </div>
            ))}
          </div>

          {l.description && <p style={{margin:0,fontSize:13.5}}>{l.description}</p>}
          <div className="muted" style={{fontSize:12}}>
            {[l.village,l.mandal,l.district,l.state].filter(Boolean).join(', ')||'—'} · posted {timeAgo(l.created_at)}
            {l.age_months?` · ${l.age_months} mo`:''}{l.weight_kg?` · ${l.weight_kg} kg`:''}{l.quantity>1?` · qty ${l.quantity}`:''}
          </div>

          {/* deal trail */}
          {(d.receipts||[]).length>0 && (
            <div>
              <div style={{fontSize:12.5,fontWeight:600,color:'var(--muted)',marginBottom:6}}><ReceiptText size={13} style={{verticalAlign:-2}}/> Receipts on this listing</div>
              {d.receipts.map((r:any)=>(
                <div key={r.id} className="muted" style={{fontSize:12.5,padding:'3px 0'}}>
                  #{r.receipt_no} · {inr(r.price)} · <span className={'badge '+(r.status==='acknowledged'?'b-ok':'b-mut')}>{r.status}</span> · {timeAgo(r.created_at)}
                </div>
              ))}
            </div>
          )}

          {/* actions */}
          <div className="row-acts" style={{borderTop:'1px solid var(--line)',paddingTop:12}}>
            {l.approval_status!=='approved' && <button className="btn ok sm" disabled={busy} onClick={()=>setApproval('approved')}><Check size={13}/> Approve</button>}
            {l.approval_status!=='rejected' && <button className="btn ghost sm" disabled={busy} onClick={()=>setApproval('rejected')}><X size={13}/> Reject</button>}
            {featured
              ? <button className="btn ghost sm" disabled={busy} onClick={()=>feature(null)}><Star size={13}/> Unfeature</button>
              : <button className="btn ghost sm" disabled={busy} onClick={()=>feature(7)}><Star size={13}/> Feature 7d</button>}
            {l.status==='removed'
              ? <button className="btn ok sm" disabled={busy} onClick={restore}><Check size={13}/> Restore</button>
              : <button className="btn danger sm" disabled={busy} onClick={remove}><Trash2 size={13}/> Remove</button>}
          </div>
        </>
      )}
    </Modal>
  );
}
