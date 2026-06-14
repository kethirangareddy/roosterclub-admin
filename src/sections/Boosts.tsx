import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Rocket, Plus, Zap } from 'lucide-react';
import { Modal, Field, Empty, Loading, inr, timeAgo } from '../ui';

const LEVELS=[
  { v:'mandal', label:'Mandal — ₹99', price:99 },
  { v:'district', label:'District — ₹199', price:199 },
  { v:'south', label:'Four States — ₹299', price:299 },
  { v:'india', label:'India-wide — ₹499', price:499 },
];

export default function Boosts(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [adding,setAdding]=useState<any|null>(null);
  const [listings,setListings]=useState<any[]>([]);

  async function load(){
    setLoading(true);
    const { data }=await supabase.from('boosts')
      .select('*,listings(breed,type),users:seller_id(full_name,phone)')
      .order('created_at',{ascending:false});
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function openAdd(){
    const { data }=await supabase.from('listings')
      .select('id,breed,type,user_id,users(full_name)').eq('status','active').order('created_at',{ascending:false}).limit(200);
    setListings(data||[]);
    setAdding({ listing_id:'', level:'mandal', price_paid:99, upi_ref:'', days:5 });
  }

  async function create(){
    const a={...adding};
    if(!a.listing_id){ alert('Pick a listing'); return; }
    const lst=listings.find(l=>l.id===a.listing_id);
    const { error }=await supabase.from('boosts').insert({
      listing_id:a.listing_id, seller_id:lst?.user_id, level:a.level,
      price_paid:Number(a.price_paid)||0, upi_ref:a.upi_ref||null,
    });
    if(error){ alert(error.message); return; }
    setAdding(null); load();
  }

  async function activate(b:any){
    const days = Number(prompt('Boost duration in days?', '5'))||5;
    const now=new Date(); const exp=new Date(now.getTime()+days*864e5);
    const { data:{ user } }=await supabase.auth.getUser();
    const e1=await supabase.from('boosts').update({
      activated_at:now.toISOString(), expires_at:exp.toISOString(), activated_by:user?.id
    }).eq('id',b.id);
    const e2=await supabase.from('listings').update({
      boost_level:b.level, boost_expires_at:exp.toISOString()
    }).eq('id',b.listing_id);
    if(e1.error||e2.error){ alert((e1.error||e2.error)?.message); return; }
    load();
  }

  return (
    <>
      <h1 className="h1">Boosts</h1>
      <p className="sub">Manual UPI flow: seller pays you directly → log it here → activate to feature the listing.</p>
      <div className="card">
        <div className="card-h">
          <h2><Rocket size={16}/> Boost payments ({rows.length})</h2>
          <button className="btn" onClick={openAdd}><Plus size={15}/> Log payment</button>
        </div>
        {loading?<Loading/>:rows.length===0?<Empty text="No boosts logged yet."/>:(
          <table>
            <thead><tr><th>Listing</th><th>Seller</th><th>Level</th><th>Paid</th><th>UPI ref</th><th>Status</th><th>Logged</th><th></th></tr></thead>
            <tbody>
              {rows.map(b=>{
                const live=b.activated_at && b.expires_at && new Date(b.expires_at)>new Date();
                return (
                  <tr key={b.id}>
                    <td><b>{b.listings?.breed||'—'}</b><div className="muted">{b.listings?.type||''}</div></td>
                    <td>{b.users?.full_name||'—'}<div className="muted">{b.users?.phone||''}</div></td>
                    <td><span className="badge b-info">{b.level}</span></td>
                    <td>{inr(b.price_paid)}</td>
                    <td className="muted">{b.upi_ref||'—'}</td>
                    <td>{live?<span className="badge b-ok">Active</span>:b.activated_at?<span className="badge b-mut">Expired</span>:<span className="badge b-warn">Pending</span>}</td>
                    <td className="muted">{timeAgo(b.created_at)}</td>
                    <td>{!b.activated_at && <button className="btn ok sm" onClick={()=>activate(b)}><Zap size={13}/> Activate</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {adding && (
        <Modal title="Log boost payment" onClose={()=>setAdding(null)}
          footer={<><button className="btn ghost" onClick={()=>setAdding(null)}>Cancel</button>
                    <button className="btn" onClick={create}>Save</button></>}>
          <Field label="Listing">
            <select style={{width:'100%'}} value={adding.listing_id} onChange={e=>setAdding({...adding,listing_id:e.target.value})}>
              <option value="">Select a listing…</option>
              {listings.map(l=><option key={l.id} value={l.id}>{l.breed} ({l.type}) — {l.users?.full_name||'?'}</option>)}
            </select>
          </Field>
          <Field label="Level">
            <select style={{width:'100%'}} value={adding.level} onChange={e=>{const lv=LEVELS.find(x=>x.v===e.target.value)!;setAdding({...adding,level:lv.v,price_paid:lv.price});}}>
              {LEVELS.map(l=><option key={l.v} value={l.v}>{l.label}</option>)}
            </select>
          </Field>
          <div className="grid2">
            <Field label="Amount paid (₹)"><input type="number" style={{width:'100%'}} value={adding.price_paid} onChange={e=>setAdding({...adding,price_paid:e.target.value})}/></Field>
            <Field label="UPI / txn reference"><input style={{width:'100%'}} value={adding.upi_ref} onChange={e=>setAdding({...adding,upi_ref:e.target.value})}/></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
