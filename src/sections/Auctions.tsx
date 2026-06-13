import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Gavel, Check, X, Trash2 } from 'lucide-react';
import { Empty, Loading, inr, timeAgo } from '../ui';

const STATUS_BADGE: Record<string,string> = {
  pending:'b-warn', approved:'b-ok', live:'b-ok', ended:'b-mut', cancelled:'b-danger',
};

export default function Auctions({ onChange }:{ onChange?:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);
    const { data }=await supabase.from('auctions').select('*').order('created_at',{ascending:false});
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function setStatus(id:string,status:string){
    const { error }=await supabase.from('auctions').update({ status }).eq('id',id);
    if(error){ alert(error.message); return; }
    load(); onChange?.();
  }
  async function remove(id:string){
    if(!confirm('Delete this auction? This cannot be undone.')) return;
    await supabase.from('auctions').delete().eq('id',id); load(); onChange?.();
  }

  const pending=rows.filter(r=>r.status==='pending').length;

  return (
    <>
      <h1 className="h1">Auctions</h1>
      <p className="sub">Hosts create auctions; review and approve them before they can go live. You can also reject or delete.</p>
      <div className="card">
        <div className="card-h">
          <h2><Gavel size={16}/> Auctions ({rows.length}){pending>0 && <span className="badge b-warn" style={{marginLeft:8}}>{pending} pending</span>}</h2>
        </div>
        {loading?<Loading/>:rows.length===0?<Empty text="No auctions yet."/>:(
          <table>
            <thead><tr><th>Title</th><th>Breed</th><th>Start ₹</th><th>Reserve ₹</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.title}</b></td>
                  <td className="muted">{r.breed||'—'}</td>
                  <td>{inr(r.starting_price)}</td>
                  <td>{r.reserve_price?inr(r.reserve_price):'—'}</td>
                  <td><span className={'badge '+(STATUS_BADGE[r.status]||'b-mut')}>{r.status}</span></td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><div className="row-acts">
                    {r.status==='pending' && <>
                      <button className="btn ok sm" onClick={()=>setStatus(r.id,'approved')}><Check size={13}/> Approve</button>
                      <button className="btn ghost sm" onClick={()=>setStatus(r.id,'cancelled')}><X size={13}/> Reject</button>
                    </>}
                    <button className="btn danger sm" onClick={()=>remove(r.id)}><Trash2 size={13}/> Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
