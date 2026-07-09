import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Modal, inr } from '../ui';
import { User, ListChecks, CircleCheck, Circle } from 'lucide-react';

const when=(iso?:string|null)=>iso?new Date(iso).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):null;

/** Receipt-360 — the full deal trail behind one receipt. */
export default function Receipt360({ receiptId, onClose, onOpenUser, onOpenListing }:{
  receiptId:string; onClose:()=>void; onOpenUser?:(userId:string)=>void; onOpenListing?:(listingId:string)=>void;
}){
  const [d,setD]=useState<any|null>(null);
  useEffect(()=>{
    supabase.rpc('admin_receipt_overview',{ p_receipt:receiptId })
      .then(({data,error})=>setD(error?{__error:error.message}:(data??{})));
  },[receiptId]);

  const r=d?.receipt;
  const steps=r?[
    { lab:'Created', at:r.created_at },
    { lab:'Issued', at:r.issued_at },
    { lab:r.status==='declined'?'Declined':'Acknowledged (sale final)', at:r.acknowledged_at, danger:r.status==='declined' },
  ]:[];

  function Party({ label, name, phone, u }:{ label:string; name?:string; phone?:string; u?:any }){
    return (
      <div style={{background:'var(--glass)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',flex:1,minWidth:0}}>
        <div style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase'}}>{label}</div>
        <div style={{fontWeight:600,fontSize:13.5,marginTop:2}}>{name||u?.full_name||'—'}{u?.banned && <span className="badge b-danger" style={{marginLeft:6}}>banned</span>}</div>
        <div className="muted" style={{fontSize:12}}>{u?.handle?'@'+u.handle+' · ':''}{phone||''}</div>
        {onOpenUser && u?.id && <button className="btn ghost sm" style={{marginTop:6}} onClick={()=>onOpenUser(u.id)}><User size={12}/> 360</button>}
      </div>
    );
  }

  return (
    <Modal title={r?`Receipt ${r.receipt_no}`:'Loading…'} onClose={onClose}>
      {!d ? <div className="loading">Loading…</div>
        : d.__error ? <div className="empty">Could not load receipt: {d.__error}</div>
        : !r ? <div className="empty">Receipt not found.</div> : (
        <>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            <span className={'badge '+(r.status==='acknowledged'?'b-ok':r.status==='declined'?'b-danger':'b-warn')}>{r.status}</span>
            <span className="badge b-mut">verify code: <b style={{fontFamily:'var(--mono)'}}>{r.verify_code||'—'}</b></span>
            <span style={{marginLeft:'auto',fontWeight:700,fontSize:18}}>{inr(r.price)}</span>
          </div>

          {/* item */}
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            {r.item_photo_url && <img src={r.item_photo_url} className="thumb" style={{width:56,height:56}}/>}
            <div style={{fontSize:13.5}}>
              <b>{r.item_label||r.breed||'Item'}</b>
              <div className="muted" style={{fontSize:12}}>
                {[r.breed,r.age_months?r.age_months+' mo':null,r.weight_kg?r.weight_kg+' kg':null,r.ring_no?'ring '+r.ring_no:null].filter(Boolean).join(' · ')||'—'}
                {' · '}payment: {r.payment_mode||'—'}
              </div>
              {d.listing?.id && onOpenListing &&
                <button className="btn ghost sm" style={{marginTop:4}} onClick={()=>onOpenListing(d.listing.id)}>
                  <ListChecks size={12}/> Listing 360 {d.listing.breed?`(${d.listing.breed})`:''}
                </button>}
            </div>
          </div>

          {/* parties */}
          <div style={{display:'flex',gap:8}}>
            <Party label="Seller" name={r.seller_name} phone={r.seller_phone} u={d.seller}/>
            <Party label="Buyer" name={r.buyer_name} phone={r.buyer_phone} u={d.buyer}/>
          </div>

          {/* timeline */}
          <div>
            <div style={{fontSize:12.5,fontWeight:600,color:'var(--muted)',marginBottom:6}}>Status timeline</div>
            {steps.map(s=>(
              <div key={s.lab} style={{display:'flex',gap:8,alignItems:'center',padding:'4px 0',fontSize:13}}>
                {s.at
                  ? <CircleCheck size={15} style={{color:s.danger?'var(--danger)':'var(--ok)'}}/>
                  : <Circle size={15} style={{color:'var(--faint)'}}/>}
                <span style={{fontWeight:s.at?600:400,color:s.at?'var(--ink)':'var(--faint)'}}>{s.lab}</span>
                <span className="muted" style={{marginLeft:'auto',fontSize:12}}>{when(s.at)||'—'}</span>
              </div>
            ))}
          </div>

          <div className="muted" style={{fontSize:11.5}}>
            chat: <span style={{fontFamily:'var(--mono)'}}>{r.chat_id||'—'}</span>
            {r.seller_farm_name?` · farm: ${r.seller_farm_name}`:''}
          </div>
        </>
      )}
    </Modal>
  );
}
