import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Trophy } from 'lucide-react';
import { Empty, Loading } from '../ui';
import { adminPhones } from '../supabase';

export default function Competitions(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);
    const { data }=await supabase.from('seller_awards')
      .select('*, user:users!seller_awards_user_id_fkey(full_name,handle)')
      .order('period_start',{ascending:false}).limit(200);
    const list=data||[];
    const phones=await adminPhones(list.map((r:any)=>r.user_id));
    setRows(list.map((r:any)=>({...r, user:r.user?{...r.user, phone:phones[r.user_id]||null}:r.user}))); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  return (
    <>
      <h1 className="h1">Competitions</h1>
      <p className="sub">Weekly Top Seller winners by district — bragging rights only, no prizes.</p>
      <div className="card">
        <div className="card-h"><h2><Trophy size={16}/> Winners ({rows.length})</h2></div>
        {loading?<Loading/>:rows.length===0?<Empty text="No winners yet. Weekly winners are crowned every Monday."/>:(
          <table>
            <thead><tr><th>Week of</th><th>Region</th><th>Winner</th><th>Phone</th><th>Sales</th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td className="muted">{r.period_start}</td>
                  <td>{r.region||'—'}</td>
                  <td><b>{r.user?.full_name||('@'+(r.user?.handle||'user'))}</b></td>
                  <td className="muted">{r.user?.phone||'—'}</td>
                  <td>{r.sales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
