import { useEffect, useState } from 'react';
import { supabase, adminPhones } from '../supabase';
import { Check, X, Inbox } from 'lucide-react';
import { Empty, Loading, loc, inr, timeAgo, useParamState, useRowKeys } from '../ui';

export default function Approvals({ onChange }:{ onChange:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useParamState<'pending'|'all'>('tab','pending');
  const [picked,setPicked]=useState<Set<string>>(new Set());
  // j/k moves the focused row, a approves, r rejects — queue clearing at typing speed.
  const [sel]=useRowKeys(rows.length,{
    a:(i)=>{ const r=rows[i]; if(r && r.approval_status!=='approved') set(r.id,'approved'); },
    r:(i)=>{ const r=rows[i]; if(r && r.approval_status!=='rejected') set(r.id,'rejected'); },
    x:(i)=>{ const r=rows[i]; if(r) togglePick(r.id); },
  });

  function togglePick(id:string){ setPicked(p=>{ const s=new Set(p); s.has(id)?s.delete(id):s.add(id); return s; }); }
  async function bulkSet(approval_status:string){
    const ids=[...picked];
    if(!confirm(`${approval_status==='approved'?'Approve':'Reject'} ${ids.length} listing${ids.length>1?'s':''}?`)) return;
    const { error }=await supabase.from('listings').update({ approval_status }).in('id',ids);
    if(error){ alert('Bulk update failed: '+error.message); return; }
    setPicked(new Set()); load(); onChange();
  }

  async function load(){
    setLoading(true);
    let q=supabase.from('listings')
      .select('id,user_id,breed,type,price,status,approval_status,created_at,state,district,mandal,village,users(full_name,handle)')
      .order('created_at',{ascending:false}).limit(100);
    if(tab==='pending') q=q.eq('approval_status','pending');
    const { data, error }=await q;
    if(error) alert('Could not load listings: '+error.message);
    const list=data||[];
    const phones=await adminPhones(list.map((r:any)=>r.user_id));
    setRows(list.map((r:any)=>({...r, users:r.users?{...r.users, phone:phones[r.user_id]||null}:r.users}))); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  async function set(id:string, approval_status:string){
    const { error }=await supabase.from('listings').update({ approval_status }).eq('id',id);
    if(error){ alert('Could not update listing: '+error.message); return; }
    setRows(r=>r.filter(x=>x.id!==id || tab==='all'));
    if(tab==='all') load();
    onChange();
  }
  async function remove(id:string){
    if(!confirm('Permanently delete this listing?')) return;
    const { error }=await supabase.from('listings').delete().eq('id',id);
    if(error){ alert('Could not delete: '+error.message); return; }
    setRows(r=>r.filter(x=>x.id!==id)); onChange();
  }

  return (
    <>
      <h1 className="h1">Approvals</h1>
      <p className="sub">Review seller listings before they go live.</p>
      <div className="tabbar">
        <button className={tab==='pending'?'active':''} onClick={()=>setTab('pending')}>Pending</button>
        <button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>All listings</button>
      </div>
      <div className="card">
        <div className="card-h"><h2><Inbox size={16}/> {tab==='pending'?'Awaiting approval':'All listings'} ({rows.length})</h2></div>
        {picked.size>0 && (
          <div className="bulkbar">
            <b>{picked.size}</b> selected
            <button className="btn ok sm" onClick={()=>bulkSet('approved')}><Check size={13}/> Approve all</button>
            <button className="btn ghost sm" onClick={()=>bulkSet('rejected')}><X size={13}/> Reject all</button>
            <button className="btn ghost sm" onClick={()=>setPicked(new Set())}>Clear</button>
          </div>
        )}
        {loading?<Loading/>:rows.length===0?<Empty text="Nothing here. Inbox zero ✦"/>:(
          <table>
            <thead><tr>
              <th className="ck"><input type="checkbox" checked={picked.size>0&&picked.size===rows.length}
                onChange={e=>setPicked(e.target.checked?new Set(rows.map(r=>r.id)):new Set())}/></th>
              <th>Breed / Type</th><th>Seller</th><th>Price</th><th>Location</th><th>Status</th><th>Posted</th><th></th></tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.id} className={i===sel?'krow':''}>
                  <td className="ck"><input type="checkbox" checked={picked.has(r.id)} onChange={()=>togglePick(r.id)}/></td>
                  <td><b>{r.breed||'—'}</b><div className="muted">{r.type}</div></td>
                  <td>{r.users?.full_name||'—'}<div className="muted">{r.users?.phone||''}</div></td>
                  <td>{inr(r.price)}</td>
                  <td className="muted">{loc(r)}</td>
                  <td>
                    <span className={'badge '+(r.approval_status==='approved'?'b-ok':r.approval_status==='rejected'?'b-danger':'b-warn')}>
                      {r.approval_status}
                    </span>
                  </td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><div className="row-acts">
                    {r.approval_status!=='approved' && <button className="btn ok sm" onClick={()=>set(r.id,'approved')}><Check size={14}/></button>}
                    {r.approval_status!=='rejected' && <button className="btn ghost sm" onClick={()=>set(r.id,'rejected')}><X size={14}/></button>}
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
