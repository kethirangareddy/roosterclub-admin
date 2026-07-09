import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { Users, ListChecks, Inbox, Truck, Siren, Rocket, Stethoscope, BookOpen,
  ShieldCheck, Flag, Award, Gavel, Star, CheckCircle2, ArrowRight, Sparkles,
  Activity, Radio, AlertTriangle, HeartPulse, Map as MapIcon, UserPlus, ReceiptText, MessagesSquare } from 'lucide-react';
import { Loading, timeAgo, Modal, inr } from '../ui';
import Listing360 from './Listing360';

const FEED_META: Record<string,{Icon:any;c:string}> = {
  signup:{Icon:UserPlus,c:'var(--ok)'}, listing:{Icon:ListChecks,c:'var(--cta)'},
  receipt:{Icon:ReceiptText,c:'var(--iris)'}, report:{Icon:Flag,c:'var(--danger)'},
  theft:{Icon:Siren,c:'var(--danger)'}, disease:{Icon:Siren,c:'var(--warn)'},
};
// Rough geographic tile layout — KA west, TS north-centre, AP east coast, TN south.
const HEAT_AREAS: Record<string,string> = {
  'Karnataka':'ka', 'Telangana':'ts', 'Andhra Pradesh':'ap', 'Tamil Nadu':'tn',
};

async function cnt(table:string, build?:(q:any)=>any){
  let q=supabase.from(table).select('id',{count:'exact',head:true});
  if(build) q=build(q);
  const { count }=await q; return count||0;
}

export default function Dashboard({ go }:{ go:(k:any,qp?:Record<string,string>)=>void }){
  const [k,setK]=useState<any>(null);
  const [err,setErr]=useState<string|null>(null);
  const [recent,setRecent]=useState<any[]>([]);
  const [districts,setDistricts]=useState<{district:string;n:number}[]>([]);

  async function load(){
    setErr(null);
    try {
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
    // Item 13 — auto-flag queue: risk ≥ 60 or 3+ reports lands in the attention queue.
    const { data:fl }=await supabase.rpc('admin_flagged_users');
    setK({users,newUsers,active,listingsToday,pendL,pendF,pendD,pendKyc,pendRep,pendBadge,pendAuc,pendFeat,vets,arts,boosts,flagged:(fl||[]).length});

    const { data:rl }=await supabase.from('listings')
      .select('id,breed,type,price,created_at,state,district').order('created_at',{ascending:false}).limit(8);
    setRecent(rl||[]);

    const { data:all }=await supabase.from('listings').select('district').not('district','is',null).limit(1000);
    const map:Record<string,number>={};
    (all||[]).forEach((r:any)=>{ if(r.district) map[r.district]=(map[r.district]||0)+1; });
    setDistricts(Object.entries(map).map(([district,n])=>({district,n:n as number}))
      .sort((a,b)=>b.n-a.n).slice(0,6));
    } catch (e:any) {
      // Without this, one failed query left the dashboard on "Loading…" forever.
      console.error('dashboard load failed:', e);
      setErr(e?.message||'Could not reach the database.');
    }
  }
  useEffect(()=>{ load(); },[]);

  // ---- Eagle eye: pulse (60s), anomalies + fn health (60s), live feed (30s poll) ----
  const [pulse,setPulse]=useState<any|null>(null);
  const [anoms,setAnoms]=useState<any[]>([]);
  const [health,setHealth]=useState<any|null>(null);
  const [feed,setFeed]=useState<any[]>([]);
  const [regions,setRegions]=useState<{state:string;district:string;n:number}[]>([]);
  const feedSince=useRef(new Date(Date.now()-24*3600e3).toISOString());
  const feedSeen=useRef<Set<string>>(new Set());

  // ---- Region drill-down: state → districts → listings (click anything geographic) ----
  type Drill={ level:'states'|'districts'|'listings'; state?:string; district?:string; prev?:Drill|null };
  const [drill,setDrill]=useState<Drill|null>(null);
  const [drillList,setDrillList]=useState<any[]>([]);
  const [drillBusy,setDrillBusy]=useState(false);
  const [open360,setOpen360]=useState<string|null>(null);

  async function openListings(district:string, state?:string, prev?:Drill|null){
    setDrill({ level:'listings', district, state, prev:prev??null });
    setDrillBusy(true);
    let q=supabase.from('listings')
      .select('id,breed,type,price,status,approval_status,created_at,village,mandal')
      .eq('district',district).order('created_at',{ascending:false}).limit(100);
    if(state) q=q.eq('state',state);
    const { data,error }=await q;
    if(error) alert('Could not load listings: '+error.message);
    setDrillList(data||[]); setDrillBusy(false);
  }

  async function tick(){
    const [p,a,h]=await Promise.all([
      supabase.rpc('admin_pulse'), supabase.rpc('admin_anomalies'), supabase.rpc('admin_fn_health'),
    ]);
    if(!p.error) setPulse(p.data);
    if(!a.error) setAnoms((a.data as any[])||[]);
    if(!h.error) setHealth(h.data);
  }
  async function pollFeed(){
    const { data }=await supabase.rpc('admin_recent_events',{ p_since:feedSince.current });
    const fresh=((data as any[])||[]).filter(e=>{
      const key=e.kind+e.id;
      if(feedSeen.current.has(key)) return false;
      feedSeen.current.add(key); return true;
    });
    if(fresh.length){
      feedSince.current=fresh.reduce((m,e)=>e.at>m?e.at:m,feedSince.current);
      setFeed(f=>[...fresh,...f].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,40));
    }
  }
  useEffect(()=>{
    tick(); pollFeed();
    supabase.rpc('admin_users_by_region').then(({data})=>setRegions((data as any[])||[]));
    const t1=setInterval(tick,60_000), t2=setInterval(pollFeed,30_000);
    return ()=>{ clearInterval(t1); clearInterval(t2); };
  },[]);

  const stateTotals:Record<string,number>={};
  regions.forEach(r=>{ if(r.state) stateTotals[r.state]=(stateTotals[r.state]||0)+Number(r.n); });
  const heatMax=Math.max(1,...Object.values(stateTotals));
  // "Rest of India": every state outside the 4 mapped tiles.
  const restStates=Object.entries(stateTotals).filter(([s])=>!HEAT_AREAS[s]).sort((a,b)=>b[1]-a[1]);
  const restTotal=restStates.reduce((a,[,n])=>a+n,0);

  if(err && !k) return (
    <>
      <h1 className="h1">Command Center</h1>
      <div className="card"><div className="empty">
        Couldn't load the dashboard — {err}
        <div style={{marginTop:12}}><button className="btn" onClick={load}>Retry</button></div>
      </div></div>
    </>
  );
  if(!k) return <Loading/>;

  // Ranked attention queue — only what actually needs the founder.
  const queue = [
    { label:'High-risk users flagged',     n:k.flagged,  go:'users', qp:{tab:'risk'}, Icon:AlertTriangle },
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

      {/* Live pulse — auto-refreshes every 60s */}
      <div className="pulse">
        {[
          { lab:'Online now', val:pulse?.online_now, Icon:Activity, hot:true },
          { lab:'Signups today', val:pulse?.signups_today, Icon:UserPlus },
          { lab:'Listings today', val:pulse?.listings_today, Icon:ListChecks },
          { lab:'Msgs / hour', val:pulse?.messages_hour, Icon:MessagesSquare },
          { lab:'Push fails 24h', val:pulse?.push_fails_24h, Icon:HeartPulse, bad:(pulse?.push_fails_24h??0)>0 },
        ].map(p=>(
          <div key={p.lab} className={'p-item'+(p.bad?' bad':'')}>
            <p.Icon size={13} style={{color:p.hot?'var(--ok)':p.bad?'var(--danger)':'var(--muted)'}}/>
            <span className="p-val">{p.val??'—'}</span>
            <span className="p-lab">{p.lab}</span>
            {p.hot && <span className="p-dot"/>}
          </div>
        ))}
      </div>

      {/* Anomaly alerts — today vs the 30-day baseline */}
      {anoms.length>0 && (
        <div className="anom">
          <AlertTriangle size={15} style={{flexShrink:0,marginTop:1}}/>
          <div>{anoms.map((a:any,i:number)=><div key={i}>{a.label}</div>)}</div>
        </div>
      )}

      <div className="dash-cols">
      <div className="dash-main">
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
                <tr key={q.label} style={{cursor:'pointer'}} onClick={()=>go(q.go,(q as any).qp)}>
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

      {/* Eagle eye: where the users are + is anything failing */}
      <div className="grid2">
        <div className="card">
          <div className="card-h"><h2><MapIcon size={16}/> Users by state</h2></div>
          <div className="heatgrid">
            {Object.entries(HEAT_AREAS).map(([state,area])=>{
              const n=stateTotals[state]||0;
              return (
                <button key={state} className="heatcell" title={`See ${state} districts`}
                  onClick={()=>setDrill({level:'districts',state,prev:null})}
                  style={{gridArea:area,
                  background:`rgba(59,111,224,${0.08+0.55*(n/heatMax)})`,
                  color:n/heatMax>0.55?'#fff':'var(--ink)'}}>
                  <div className="h-n">{n}</div>
                  <div className="h-s">{state}</div>
                </button>
              );
            })}
            <button className="heatcell rest" title="See other states"
              onClick={()=>setDrill({level:'states',prev:null})}
              style={{gridArea:'rest',background:`rgba(59,111,224,${0.08+0.55*(Math.min(restTotal,heatMax)/heatMax)})`,
                color:restTotal/heatMax>0.55?'#fff':'var(--ink)'}}>
              <span className="h-n">{restTotal}</span>
              <span className="h-s">Rest of India{restStates.length?` · ${restStates.length} state${restStates.length>1?'s':''}`:''}</span>
            </button>
          </div>
          <div style={{padding:'0 18px 12px',fontSize:12}} className="muted">
            Top districts: {regions.filter(r=>r.district).slice(0,4).map(r=>`${r.district} ${r.n}`).join(' · ')||'—'}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h2><HeartPulse size={16}/> Function health</h2>
            {(health?.http_fails_24h??0)>0
              ? <span className="badge b-danger">{health.http_fails_24h} failed 24h</span>
              : <span className="badge b-ok">healthy</span>}
          </div>
          {(!health || (health.http_recent.length===0 && health.fn_recent.length===0))
            ? <div className="empty" style={{padding:'26px 16px'}}>No push/edge-function failures in 24h.</div>
            : <div style={{padding:'10px 18px 14px',display:'grid',gap:6}}>
                {[...(health.fn_recent||[]).map((e:any)=>({t:`${e.fn}: ${e.message||'error'}`,at:e.at})),
                  ...(health.http_recent||[]).map((e:any)=>({t:`push HTTP ${e.status??'ERR'}${e.error?' — '+e.error:''}`,at:e.at}))]
                  .slice(0,8).map((e,i)=>(
                  <div key={i} style={{fontSize:12,color:'var(--danger)'}}>{e.t}
                    <span className="muted" style={{marginLeft:6}}>{timeAgo(e.at)}</span>
                  </div>
                ))}
              </div>}
        </div>
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
                <tr key={d.district} style={{cursor:'pointer'}} title="See listings in this district"
                  onClick={()=>openListings(d.district)}>
                  <td>{d.district}</td><td className="right">{d.n}</td></tr>
              ))}
              {districts.length===0 && <tr><td colSpan={2} className="empty">No data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      </div>{/* /dash-main */}

      {/* Security camera for the marketplace — new events, newest first (30s poll) */}
      <aside className="dash-feed">
        <div className="card" style={{position:'sticky',top:14}}>
          <div className="card-h"><h2><Radio size={15}/> Happening now</h2><span className="p-dot"/></div>
          <div className="feedlist">
            {feed.length===0
              ? <div className="empty" style={{padding:'24px 12px'}}>Quiet right now — new signups, listings, receipts and alerts stream in here.</div>
              : feed.map((e:any)=>{
                  const m=FEED_META[e.kind]||FEED_META.listing;
                  return (
                    <div key={e.kind+e.id} className="feedrow">
                      <m.Icon size={14} style={{color:m.c,flexShrink:0,marginTop:2}}/>
                      <div style={{minWidth:0}}>
                        <div className="f-t">{e.title}</div>
                        <div className="f-s">{e.kind} · {e.subtitle} · {timeAgo(e.at)}</div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </aside>
      </div>{/* /dash-cols */}

      {/* Region drill-down modal: states → districts → listings */}
      {drill && (
        <Modal
          title={drill.level==='states' ? 'Rest of India — users by state'
            : drill.level==='districts' ? `${drill.state} — districts`
            : `Listings in ${drill.district}`}
          onClose={()=>setDrill(null)}>
          {drill.prev!==null && drill.prev!==undefined && (
            <button className="btn ghost sm" style={{alignSelf:'flex-start'}} onClick={()=>setDrill(drill.prev!)}>← Back</button>
          )}
          {drill.level==='states' && (
            restStates.length===0 ? <div className="empty">No users outside the four mapped states yet.</div> :
            <table><thead><tr><th>State</th><th className="right">Users</th></tr></thead><tbody>
              {restStates.map(([s,n])=>(
                <tr key={s} style={{cursor:'pointer'}} onClick={()=>setDrill({level:'districts',state:s,prev:drill})}>
                  <td style={{fontWeight:600}}>{s}</td><td className="right">{n}</td>
                </tr>
              ))}
            </tbody></table>
          )}
          {drill.level==='districts' && (()=> {
            const ds=regions.filter(r=>r.state===drill.state && r.district).sort((a,b)=>Number(b.n)-Number(a.n));
            return ds.length===0 ? <div className="empty">No district data for {drill.state} yet.</div> :
              <table><thead><tr><th>District</th><th className="right">Users</th></tr></thead><tbody>
                {ds.map(d=>(
                  <tr key={d.district} style={{cursor:'pointer'}} title="See listings"
                    onClick={()=>openListings(d.district, drill.state, drill)}>
                    <td style={{fontWeight:600}}>{d.district}</td><td className="right">{d.n}</td>
                  </tr>
                ))}
              </tbody></table>;
          })()}
          {drill.level==='listings' && (
            drillBusy ? <Loading/> :
            drillList.length===0 ? <div className="empty">No listings in {drill.district}.</div> :
            <table><thead><tr><th>Breed</th><th>Type</th><th>Price</th><th>Status</th><th>Posted</th></tr></thead><tbody>
              {drillList.map(l=>(
                <tr key={l.id} style={{cursor:'pointer'}} title="Open listing 360" onClick={()=>setOpen360(l.id)}>
                  <td style={{fontWeight:600}}>{l.breed||'—'}<div className="muted" style={{fontSize:11}}>{[l.village,l.mandal].filter(Boolean).join(', ')}</div></td>
                  <td><span className="badge b-mut">{l.type}</span></td>
                  <td>{inr(l.price)}</td>
                  <td><span className={'badge '+(l.status==='active'&&l.approval_status==='approved'?'b-ok':l.approval_status==='pending'?'b-warn':'b-mut')}>{l.approval_status==='pending'?'pending':l.status}</span></td>
                  <td className="muted">{timeAgo(l.created_at)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Modal>
      )}
      {open360 && <Listing360 listingId={open360} onClose={()=>setOpen360(null)} onChanged={load}/>}
    </>
  );
}
