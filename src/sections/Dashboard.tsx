import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Users, ListChecks, Inbox, Truck, Siren, Rocket, Stethoscope, BookOpen,
  ShieldCheck, Flag, Award, Gavel, Star, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
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
    const day=new Date(Date.now()-864e5).toISOString();
    const [users,newUsers,active,listingsToday,pendL,pendF,pendD,pendKyc,pendRep,pendBadge,pendAuc,pendFeat,vets,arts,boosts]=await Promise.all([
      cnt('users'),
      cnt('users',q=>q.gte('created_at',wk)),
      cnt('listings',q=>q.eq('status','active').eq('approval_status','approved').gt('expires_at',nowIso)),
      cnt('listings',q=>q.gte('created_at',day)),
      cnt('listings',q=>q.eq('approval_status','pending')),
      cnt('live_feed_sellers',q=>q.eq('approved',false)),
      cnt('disease_alerts',q=>q.eq('verified',false)),
      cnt('kyc_submissions',q=>q.eq('status','pending')),
      cnt('reports',q=>q.eq('status','open')),
      cnt('badge_requests',q=>q.eq('status','pending')),
      cnt('auctions',q=>q.eq('status','pending')),
      cnt('feature_requests',q=>q.eq('status','pending')),
      cnt('vets'), cnt('kukuta_articles'),
      cnt('boosts',q=>q.is('activated_at',null)),
    ]);
    setK({users,newUsers,active,listingsToday,pendL,pendF,pendD,pendKyc,pendRep,pendBadge,pendAuc,pendFeat,vets,arts,boosts});

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

  // Ranked attention queue — only what actually needs the founder.
  const queue = [
    { label:'Listings awaiting approval', n:k.pendL,    go:'approvals', Icon:Inbox },
    { label:'KYC verifications pending',   n:k.pendKyc,  go:'kyc',       Icon:ShieldCheck },
    { label:'Open reports',                n:k.pendRep,  go:'reports',   Icon:Flag },
    { label:'Badge requests',              n:k.pendBadge,go:'badges',    Icon:Award },
    { label:'Auctions to approve',         n:k.pendAuc,  go:'auctions',  Icon:Gavel },
    { label:'Feature requests',            n:k.pendFeat, go:'featured',  Icon:Star },
    { label:'Live-feed sellers waiting',   n:k.pendF,    go:'livefeed',  Icon:Truck },
    { label:'Disease reports to verify',   n:k.pendD,    go:'disease',   Icon:Siren },
    { label:'Boosts to activate',          n:k.boosts,   go:'boosts',    Icon:Rocket },
  ].filter(q=>q.n>0).sort((a,b)=>b.n-a.n);

  const totalPending = queue.reduce((s,q)=>s+q.n,0);
  const topDistrict = districts[0]?.district;

  // Computed brief (not LLM — real numbers, reads like a briefing).
  const brief = [
    `${k.newUsers} new ${k.newUsers===1?'user':'users'} this week`,
    `${k.listingsToday} ${k.listingsToday===1?'listing':'listings'} today`,
    totalPending>0 ? `${totalPending} ${totalPending===1?'item':'items'} need review` : 'queue clear',
    topDistrict ? `${topDistrict} leads activity` : null,
  ].filter(Boolean).join('  ·  ');

  const cards = [
    { lab:'Total users', val:k.users, delta:`+${k.newUsers} this week`, Icon:Users },
    { lab:'Active listings', val:k.active, Icon:ListChecks },
    { lab:'Listings today', val:k.listingsToday, Icon:Inbox },
    { lab:'Needs review', val:totalPending, delta:totalPending?'open queue':'all clear', Icon:Inbox, go:queue[0]?.go },
    { lab:'Vets listed', val:k.vets, Icon:Stethoscope, go:'vets' },
    { lab:'Kukuta articles', val:k.arts, Icon:BookOpen, go:'kukuta' },
  ];

  return (
    <>
      <h1 className="h1">Command Center</h1>
      <p className="sub">Rooster Club · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>

      {/* Brief */}
      <div className="card" style={{borderColor:'rgba(139,124,255,.3)',background:'linear-gradient(180deg,rgba(139,124,255,.10),rgba(139,124,255,.02))'}}>
        <div style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:10}}>
          <Sparkles size={16} style={{color:'#8B7CFF',flexShrink:0}}/>
          <span style={{fontSize:13.5,color:'var(--ink)'}}>{brief}.</span>
        </div>
      </div>

      {/* Attention queue */}
      <div className="card">
        <div className="card-h"><h2><Inbox size={16}/> Needs your attention</h2>
          {totalPending>0 && <span className="badge b-info">{totalPending} open</span>}</div>
        {queue.length===0
          ? <div className="empty"><CheckCircle2 size={26} style={{color:'var(--ok)',marginBottom:8}}/><div>All clear — nothing needs you right now.</div></div>
          : <table><tbody>
              {queue.map(q=>(
                <tr key={q.label} style={{cursor:'pointer'}} onClick={()=>go(q.go)}>
                  <td style={{width:38}}><q.Icon size={17} style={{color:'var(--cta)'}}/></td>
                  <td style={{fontWeight:600}}>{q.label}</td>
                  <td className="right"><span className="badge b-warn">{q.n}</span></td>
                  <td className="right" style={{width:120}}>
                    <button className="btn sm ghost">Review <ArrowRight size={12} style={{verticalAlign:-1}}/></button>
                  </td>
                </tr>
              ))}
            </tbody></table>}
      </div>

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

      <div className="grid2">
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
      </div>
    </>
  );
}
