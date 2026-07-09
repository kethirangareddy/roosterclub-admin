import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { TrendingUp } from 'lucide-react';
import { Empty, Loading } from '../ui';

export default function Acquisition(){
  const [rows,setRows]=useState<{source:string;count:number}[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);
    // Server-side group-by (admin_acquisition_counts RPC) — the old per-row select
    // was silently capped at 1000 users, skewing the percentages at scale.
    const { data, error }=await supabase.rpc('admin_acquisition_counts');
    if(error) alert('Could not load acquisition data: '+error.message);
    const arr=(data||[]).map((r:any)=>({ source:r.source, count:Number(r.n) }));
    setRows(arr); setTotal(arr.reduce((s:number,r:any)=>s+r.count,0)); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  return (
    <>
      <h1 className="h1">Acquisition</h1>
      <p className="sub">Where your users came from — self-reported "How did you hear about us?" at signup.</p>
      <div className="card">
        <div className="card-h"><h2><TrendingUp size={16}/> Sign-ups by source ({total})</h2></div>
        {loading?<Loading/>:rows.length===0?<Empty text="No sign-ups yet."/>:(
          <table>
            <thead><tr><th>Source</th><th>Users</th><th>Share</th></tr></thead>
            <tbody>
              {rows.map(r=>{
                const pct = total ? Math.round(r.count/total*100) : 0;
                return (
                  <tr key={r.source}>
                    <td><b>{r.source}</b></td>
                    <td>{r.count}</td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{height:8,width:140,background:'#eee',borderRadius:4,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${pct}%`,background:'#BA7517'}}/>
                        </div>
                        <span className="muted">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
