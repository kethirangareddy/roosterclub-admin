import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Users as UsersIcon, Search, ShieldCheck } from 'lucide-react';
import { Empty, Loading, loc } from '../ui';

const BADGES:{v:string;label:string}[]=[
  {v:'',label:'No badge'},
  {v:'founding_member',label:'Founding Member'},
  {v:'bronze',label:'Bronze'},
  {v:'silver',label:'Silver'},
  {v:'gold_star',label:'Gold Star'},
  {v:'legendary',label:'Legendary'},
];

export default function UsersSection(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [q,setQ]=useState('');

  async function load(){
    setLoading(true);
    let req=supabase.from('users')
      .select('id,full_name,handle,phone,badge,aadhaar_verified,banned,state,district,created_at')
      .order('created_at',{ascending:false}).limit(200);
    if(q.trim()){
      const t=`%${q.trim()}%`;
      req=req.or(`full_name.ilike.${t},handle.ilike.${t},phone.ilike.${t}`);
    }
    const { data }=await req;
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function setBadge(id:string, badge:string){
    const { error }=await supabase.from('users')
      .update({ badge:badge||null, badge_awarded_at:badge?new Date().toISOString():null }).eq('id',id);
    if(error){ alert('Could not save badge: '+error.message); return; }
    setRows(r=>r.map(x=>x.id===id?{...x,badge:badge||null}:x));
  }
  async function toggleBan(u:any){
    if(!confirm(u.banned?'Unban this user?':'Ban this user?')) return;
    const { error }=await supabase.from('users').update({ banned:!u.banned }).eq('id',u.id);
    if(error){ alert('Could not update: '+error.message); return; }
    setRows(r=>r.map(x=>x.id===u.id?{...x,banned:!u.banned}:x));
  }

  return (
    <>
      <h1 className="h1">Users &amp; Badges</h1>
      <p className="sub">Assign prestige badges (all admin-controlled) and manage accounts.</p>
      <div className="card">
        <div className="card-h">
          <h2><UsersIcon size={16}/> Users ({rows.length})</h2>
          <div className="toolbar">
            <input placeholder="Search name, handle, phone…" value={q}
              onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} style={{width:240}}/>
            <button className="btn ghost sm" onClick={load}><Search size={14}/> Search</button>
          </div>
        </div>
        {loading?<Loading/>:rows.length===0?<Empty text="No users found."/>:(
          <table>
            <thead><tr><th>Name</th><th>Handle</th><th>Phone</th><th>Location</th><th>Verified</th><th>Badge</th><th></th></tr></thead>
            <tbody>
              {rows.map(u=>(
                <tr key={u.id} style={u.banned?{opacity:.55}:undefined}>
                  <td><b>{u.full_name||'—'}</b>{u.banned&&<span className="badge b-danger" style={{marginLeft:6}}>Banned</span>}</td>
                  <td className="muted">{u.handle?'@'+u.handle:'—'}</td>
                  <td className="muted">{u.phone||'—'}</td>
                  <td className="muted">{loc(u)}</td>
                  <td>{u.aadhaar_verified?<span className="badge b-ok"><ShieldCheck size={12}/> KYC</span>:<span className="badge b-mut">—</span>}</td>
                  <td>
                    <select value={u.badge||''} onChange={e=>setBadge(u.id,e.target.value)}>
                      {BADGES.map(b=><option key={b.v} value={b.v}>{b.label}</option>)}
                    </select>
                  </td>
                  <td><button className={'btn sm '+(u.banned?'ghost':'danger')} onClick={()=>toggleBan(u)}>{u.banned?'Unban':'Ban'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
