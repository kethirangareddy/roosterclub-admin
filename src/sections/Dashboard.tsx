import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Users, ListChecks, Inbox, Truck, Siren, Rocket, Stethoscope, BookOpen } from 'lucide-react';
import { Loading, timeAgo } from '../ui';

async function cnt(table:string, build?:(q:any)=>any){
  let q=supabase.from(table).select('id',{count:'exact',head:true});
  if(build) q=build(q);
  const { count }=await q; return count||0;
}

export default function Dashboard({ go }:{ go:(k:any)=>void }){
  const [k,setK]=useState<any>(null);
  const [recent,setRecent]=useState<any[]>([]);
  const [districts,setDistricts]=useState<{district:string;n:number}[]>([]);

  useEffect(()=>{(async()=>{
    const nowIso=new Date().toISOString();
    const wk=new Date(Date.now()-7*864e5).toISOString();
    const [users,newUsers,active,pendL,pendF,pendD,vets,arts,boosts]=await Promise.all([
      cnt('users'),
      cnt('users',q=>q.gte('created_at',wk)),
      cnt('listings',q=>q.eq('status','active').eq('approval_status','approved').gt('expires_at',nowIso)),
      cnt('listings',q=>q.eq('approval_status','pending')),
      cnt('live_feed_sellers',q=>q.eq('approved',false)),
      cnt('disease_alerts',q=>q.eq('verified',false)),
      cnt('vets'), cnt('kukuta_articles'),
      cnt('boosts',q=>q.is('activated_at',null)),
    ]);
    setK({users,newUsers,active,pendL,pendF,pendD,vets,arts,boosts});

    const { data:rl }=await supabase.from('listings')
      .select('id,breed,type,price,created_at,state,district').order('created_at',{ascending:false}).limit(8);
    setRecent(rl||[]);

    const { data:all }=await supabase.from('listings').select('district').not('district','is',null).limit(1000);
    const map:Record<string,number>={};
    (all||[]).forEach((r:any)=>{ if(r.district) map[r.district]=(map[r.district]||0)+1; });
    setDistricts(Object.entries(map).map(([district,n])=>({district,n:n as number}))
      .sort((a,b)=>b.n-a.n).slice(0,6));
  })()},[]);

  if(!k) return <Loading/>;
  const pending = k.pendL + k.pendF + k.pendD;

  const cards = [
    { lab:'Total users', val:k.users, delta:`+${k.newUsers} this week`, Icon:Users },
    { lab:'Active listings', val:k.active, Icon:ListChecks },
    { lab:'Pending approvals', val:pending, delta:'needs review', Icon:Inbox, go:'approvals' },
    { lab:'Live-feed requests', val:k.pendF, Icon:Truck, go:'livefeed' },
    { lab:'Unverified disease reports', val:k.pendD, Icon:Siren, go:'disease' },
    { lab:'Boosts to activate', val:k.boosts, Icon:Rocket, go:'boosts' },
    { lab:'Vets listed', val:k.vets, Icon:Stethoscope, go:'vets' },
    { lab:'Kukuta articles', val:k.arts, Icon:BookOpen, go:'kukuta' },
  ];

  return (
    <>
      <h1 className="h1">Dashboard</h1>
      <p className="sub">Live overview of Rooster Club · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
      <div className="kpis">
        {cards.map(c=>(
          <div className="kpi" key={c.lab} onClick={c.go?()=>go(c.go):undefined}
            style={c.go?{cursor:'pointer'}:undefined}>
            <div className="lab"><c.Icon size={14}/> {c.lab}</div>
            <div className="val">{c.val}</div>
            {c.delta && <div className="delta">{c.delta}</div>}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-h"><h2><ListChecks size={16}/> Latest listings</h2></div>
        <table>
          <thead><tr><th>Breed</th><th>Type</th><th>Price</th><th>Location</th><th>Posted</th></tr></thead>
          <tbody>
            {recent.map(r=>(
              <tr key={r.id}>
                <td style={{fontWeight:600}}>{r.breed||'—'}</td>
                <td><span className="badge b-mut">{r.type}</span></td>
                <td>{r.price?'₹'+r.price.toLocaleString('en-IN'):'—'}</td>
                <td className="muted">{[r.district,r.state].filter(Boolean).join(', ')||'—'}</td>
                <td className="muted">{timeAgo(r.created_at)}</td>
              </tr>
            ))}
            {recent.length===0 && <tr><td colSpan={5} className="empty">No listings yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-h"><h2>Most active districts</h2></div>
        <table>
          <thead><tr><th>District</th><th className="right">Listings</th></tr></thead>
          <tbody>
            {districts.map(d=>(
              <tr key={d.district}><td>{d.district}</td><td className="right">{d.n}</td></tr>
            ))}
            {districts.length===0 && <tr><td colSpan={2} className="empty">No data yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
