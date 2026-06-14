import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Store } from 'lucide-react';
import { Empty, Loading, loc, inr, timeAgo } from '../ui';

export default function Shop(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);
    const { data }=await supabase.from('shop_products')
      .select('*,users(full_name)').order('created_at',{ascending:false}).limit(200);
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function toggle(r:any){
    const next=r.status==='active'?'suspended':'active';
    const { error }=await supabase.from('shop_products').update({ status:next }).eq('id',r.id);
    if(error){ alert('Could not update product: '+error.message); return; }
    setRows(x=>x.map(p=>p.id===r.id?{...p,status:next}:p));
  }
  async function remove(id:string){
    if(!confirm('Delete this product?')) return;
    const { error }=await supabase.from('shop_products').delete().eq('id',id);
    if(error){ alert('Could not delete: '+error.message); return; }
    setRows(x=>x.filter(p=>p.id!==id));
  }

  return (
    <>
      <h1 className="h1">Shop</h1>
      <p className="sub">Moderate storefront products. Suspend or remove anything that violates rules.</p>
      <div className="card">
        <div className="card-h"><h2><Store size={16}/> Products ({rows.length})</h2></div>
        {loading?<Loading/>:rows.length===0?<Empty text="No shop products yet."/>:(
          <table>
            <thead><tr><th></th><th>Product</th><th>Seller</th><th>Category</th><th>Price</th><th>Stock</th><th>Location</th><th>Status</th><th>Added</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} style={r.status!=='active'?{opacity:.55}:undefined}>
                  <td>{r.image_url?<img className="thumb" src={r.image_url}/>:<div className="thumb"/>}</td>
                  <td><b>{r.name}</b>{r.brand&&<div className="muted">{r.brand}</div>}</td>
                  <td className="muted">{r.users?.full_name||'—'}</td>
                  <td><span className="badge b-mut">{r.category||'—'}</span></td>
                  <td>{inr(r.price)}{r.unit?<span className="muted">/{r.unit}</span>:''}</td>
                  <td className="muted">{r.stock_count??'—'}</td>
                  <td className="muted">{loc(r)}</td>
                  <td><span className={'badge '+(r.status==='active'?'b-ok':'b-mut')}>{r.status||'active'}</span></td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><div className="row-acts">
                    <button className="btn ghost sm" onClick={()=>toggle(r)}>{r.status==='active'?'Suspend':'Activate'}</button>
                    <button className="btn danger sm" onClick={()=>remove(r.id)}>Delete</button>
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
