import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { Users, ListChecks, Inbox, Truck, Siren, Rocket, Stethoscope,
  ShieldCheck, Flag, Award, Gavel, Star, CheckCircle2, ArrowRight, Sparkles,
  Activity, Radio, AlertTriangle, HeartPulse, Map as MapIcon, UserPlus, ReceiptText,
  MessagesSquare, Store, Shield, ShieldAlert, Repeat, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { Loading, timeAgo, Modal, inr, UserLink, ListingLink, ReceiptLink } from '../ui';
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

// The one ranked list. `sev` pins the time-sensitive queues above the merely
// numerous ones; everything else sorts by size. Counts come from the single
// admin_counts() RPC the shell already fetched — the dashboard used to re-run
// all sixteen of these itself.
const QUEUE: {key:string;label:string;go:string;Icon:any;sev:number;qp?:Record<string,string>}[] = [
  { key:'theft',      label:'Active theft alerts',          go:'theft',    Icon:ShieldAlert, sev:3 },
  { key:'flagged',    label:'High-risk users flagged',      go:'users',    Icon:AlertTriangle, sev:3, qp:{tab:'risk'} },
  { key:'reports',    label:'Open reports',                 go:'reports',  Icon:Flag,        sev:2 },
  { key:'disease',    label:'Disease reports to verify',    go:'disease',  Icon:Siren,       sev:2 },
  { key:'approvals',  label:'Listings awaiting approval',   go:'approvals',Icon:Inbox,       sev:1 },
  { key:'kyc',        label:'KYC verifications pending',    go:'kyc',      Icon:ShieldCheck, sev:1 },
  { key:'badges',     label:'Badge requests',               go:'badges',   Icon:Award,       sev:1 },
  { key:'orders',     label:'Shop orders to fulfil',        go:'orders',   Icon:Store,       sev:1 },
  { key:'syndicates', label:'Syndicates to approve',        go:'syndicates',Icon:Shield,     sev:0 },
  { key:'auctions',   label:'Auctions to approve',          go:'auctions', Icon:Gavel,       sev:0 },
  { key:'featured',   label:'Feature requests',             go:'featured', Icon:Star,        sev:0 },
  { key:'boosts',     label:'Boosts to activate',           go:'boosts',   Icon:Rocket,      sev:0 },
  { key:'livefeed',   label:'Live-feed sellers waiting',    go:'livefeed', Icon:Truck,       sev:0 },
  { key:'vets',       label:'Doctors awaiting approval',    go:'vets',     Icon:Stethoscope, sev:0 },
];

const pct = (a:number, b:number) => b > 0 ? Math.round(a/b*100) : 0;

export default function Dashboard({ go, counts }:{
  go:(k:any,qp?:Record<string,string>)=>void;
  counts:Record<string,any>;
}){
  const [err,setErr]=useState<string|null>(null);
  const [pulse,setPulse]=useState<any|null>(null);
  const [anoms,setAnoms]=useState<any[]>([]);
  const [health,setHealth]=useState<any|null>(null);
  const [sms,setSms]=useState<any|null>(null);
  const [twBal,setTwBal]=useState<{balance:string;currency:string}|null>(null);
  const [reach,setReach]=useState<any|null>(null);
  const [fh,setFh]=useState<any|null>(null);       // funnel health (30d)
  const [coh,setCoh]=useState<any[]>([]);          // last few signup cohorts
  const [feed,setFeed]=useState<any[]>([]);
  const [regions,setRegions]=useState<{state:string;district:string;n:number}[]>([]);
  const [sysOpen,setSysOpen]=useState(false);
  const feedSince=useRef(new Date(Date.now()-24*3600e3).toISOString());
  const feedSeen=useRef<Set<string>>(new Set());
  // "Since you last looked": the timestamp of the newest event you had already
  // seen, frozen for this visit so the divider doesn't crawl while you read.
  const lastVisit=useRef<string>(localStorage.getItem('rc_last_visit')||'');
  useEffect(()=>{
    const mark=()=>{ try{ localStorage.setItem('rc_last_visit',new Date().toISOString()); }catch{} };
    const t=setInterval(mark,60_000);
    window.addEventListener('beforeunload',mark);
    return ()=>{ clearInterval(t); window.removeEventListener('beforeunload',mark); mark(); };
  },[]);

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

  // Live strip + health, every 60s.
  async function tick(){
    const [p,a,h,s]=await Promise.all([
      supabase.rpc('admin_pulse'), supabase.rpc('admin_anomalies'),
      supabase.rpc('admin_fn_health'), supabase.rpc('admin_sms_health'),
    ]);
    if(!p.error) setPulse(p.data);
    if(!a.error) setAnoms((a.data as any[])||[]);
    if(!h.error) setHealth(h.data);
    if(!s.error) setSms(s.data);
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

  // Slow-moving panels: fetched once per mount.
  async function loadSlow(){
    setErr(null);
    try {
      const [rg,rc,fn,co]=await Promise.all([
        supabase.rpc('admin_users_by_region'),
        supabase.rpc('admin_push_reach'),
        supabase.rpc('admin_funnel_health',{ p_days:30 }),
        supabase.rpc('admin_cohorts',{ p_days:3 }),
      ]);
      setRegions((rg.data as any[])||[]);
      setReach(rc.data); setFh(fn.data); setCoh((co.data as any[])||[]);
    } catch(e:any){
      console.error('dashboard load failed:', e);
      setErr(e?.message||'Could not reach the database.');
    }
  }

  useEffect(()=>{
    tick(); pollFeed(); loadSlow();
    supabase.functions.invoke('twilio-balance').then(({data})=>{ if(data && !(data as any).error) setTwBal(data as any); });
    const t1=setInterval(tick,60_000), t2=setInterval(pollFeed,30_000);
    return ()=>{ clearInterval(t1); clearInterval(t2); };
  },[]);

  const stateTotals:Record<string,number>={};
  regions.forEach(r=>{ if(r.state) stateTotals[r.state]=(stateTotals[r.state]||0)+Number(r.n); });
  const heatMax=Math.max(1,...Object.values(stateTotals));
  const restStates=Object.entries(stateTotals).filter(([s])=>!HEAT_AREAS[s]).sort((a,b)=>b[1]-a[1]);
  const restTotal=restStates.reduce((a,[,n])=>a+n,0);

  if(err && !counts.users) return (
    <>
      <h1 className="h1">Command Center</h1>
      <div className="card"><div className="empty">
        Couldn't load the dashboard — {err}
        <div style={{marginTop:12}}><button className="btn" onClick={loadSlow}>Retry</button></div>
      </div></div>
    </>
  );
  if(!counts.users) return <Loading/>;

  const queue=QUEUE.map(q=>({...q,n:Number(counts[q.key]||0)}))
    .filter(q=>q.n>0)
    .sort((a,b)=>b.sev-a.sev || b.n-a.n);
  const totalPending=queue.reduce((s,q)=>s+q.n,0);

  // Yesterday's signup cohort — did they come back? This is the number that says
  // whether an SMS/ads push bought users or bought installs.
  const y=coh.find(c=>{
    const d=new Date(); d.setDate(d.getDate()-1);
    return c.cohort===d.toISOString().slice(0,10);
  });
  const d1=y && Number(y.signups)>0 ? pct(Number(y.d1_back),Number(y.signups)) : null;

  // How many feed rows landed after your last visit. Feed is newest-first, so
  // this is also the index the divider goes at.
  const newSince = lastVisit.current ? feed.filter(e=>e.at>lastVisit.current).length : 0;

  const reachable = reach ? Number(reach.with_token) : 0;
  const reachPct  = reach ? pct(reachable, Number(reach.users)) : 0;

  // Systems: one line. Green when nothing is wrong, red with the reason when it is.
  const smsBad = !!sms && ((sms.failed_1h??0)>0 || ((sms.sent_1h??0)>=6 && (sms.logins_1h??0)===0) || (sms.stuck_2h??0)>=8);
  const fnBad  = (health?.http_fails_24h??0)>0;
  const sysBad = smsBad||fnBad;
  const sysLine = smsBad ? 'OTP / SMS — logins at risk'
    : fnBad ? `${health.http_fails_24h} push/function failures in 24h`
    : 'OTP, push and functions all healthy';

  const brief=[
    `${counts.signups_today} ${counts.signups_today===1?'signup':'signups'} today`,
    `${counts.new_users_7d} this week`,
    d1!==null ? `${d1}% of yesterday's signups came back` : null,
    `${counts.listings_today} ${counts.listings_today===1?'listing':'listings'} today`,
    totalPending>0 ? `${totalPending} ${totalPending===1?'item':'items'} need review` : 'queue clear',
  ].filter(Boolean).join('  ·  ');

  const cards=[
    { lab:'Total users', val:counts.users, delta:`+${counts.new_users_7d} this week`, Icon:Users },
    { lab:'Came back D1', val:d1===null?'—':d1+'%', delta:y?`of ${y.signups} yesterday`:'no cohort yet', Icon:Repeat, go:'analytics' },
    { lab:'Active listings', val:counts.active_listings, delta:`${counts.listings_today} posted today`, Icon:ListChecks, go:'listings' },
    { lab:'Reachable by push', val:reach?`${reachPct}%`:'—', delta:reach?`${reach.active30_no_token} active users have no token`:undefined, Icon:HeartPulse },
    { lab:'Chats with no reply', val:fh?fh.chats_no_seller_reply:'—', delta:fh?`of ${fh.chats} in 30d`:undefined, Icon:MessagesSquare, go:'analytics' },
    { lab:'Median first reply', val:fh?.median_first_reply_min!=null?`${fh.median_first_reply_min}m`:'—', delta:'seller → buyer', Icon:Clock },
  ];

  return (
    <>
      <h1 className="h1">Command Center</h1>
      <p className="sub">Rooster Club · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>

      {/* 1 — SYSTEMS. One line. It only opens when something is actually wrong. */}
      <button className={'sysbar'+(sysBad?' bad':'')} onClick={()=>setSysOpen(v=>!v)}>
        <span className={'sysdot'+(sysBad?' bad':'')}/>
        <span className="sysline">{sysLine}</span>
        {sms?.last_ok_provider && <span className="sysmeta">{sms.last_ok_provider}</span>}
        {twBal && <span className="sysmeta">SMS bal {`${twBal.currency||''} ${twBal.balance}`.trim()}</span>}
        {sysOpen?<ChevronDown size={14}/>:<ChevronRight size={14}/>}
      </button>
      {sysOpen && (
        <div className="card syspanel">
          <div className="sysgrid">
            <div><b>{sms?.sent_1h??'—'}</b><span>OTP sent 1h</span></div>
            <div><b style={{color:(sms?.sent_1h>=6&&sms?.logins_1h===0)?'var(--danger)':undefined}}>{sms?.logins_1h??'—'}</b><span>logins 1h</span></div>
            <div><b style={{color:sms?.stuck_2h>=8?'var(--danger)':undefined}}>{sms?.stuck_2h??'—'}</b><span>stuck 2h</span></div>
            <div><b style={{color:fnBad?'var(--danger)':undefined}}>{health?.http_fails_24h??0}</b><span>push fails 24h</span></div>
            <div><b>{reach?.tokens??'—'}</b><span>push tokens</span></div>
            <div><b style={{color:(reach?.stale_tokens??0)>0?'var(--warn)':undefined}}>{reach?.stale_tokens??'—'}</b><span>stale 60d+</span></div>
          </div>
          {sms?.last_ok_at && <div className="muted" style={{fontSize:12.5,padding:'0 18px 6px'}}>
            Carrier <b style={{color:'var(--ink)'}}>{sms.last_ok_provider}</b> · last OK {timeAgo(sms.last_ok_at)}
            {sms.failovers_24h>0 && <span style={{color:'var(--warn)'}}> · {sms.failovers_24h} failover{sms.failovers_24h>1?'s':''} in 24h</span>}
          </div>}
          {[...(sms?.alerts||[]).map((a:any)=>({t:a.detail,at:a.at})),
            ...(health?.fn_recent||[]).map((e:any)=>({t:`${e.fn}: ${e.message||'error'}`,at:e.at})),
            ...(health?.http_recent||[]).map((e:any)=>({t:`push HTTP ${e.status??'ERR'}${e.error?' — '+e.error:''}`,at:e.at}))]
            .slice(0,6).map((e,i)=>(
              <div key={i} style={{fontSize:12,color:'var(--danger)',padding:'0 18px 4px'}}>{e.t}
                <span className="muted" style={{marginLeft:6}}>{timeAgo(e.at)}</span></div>
          ))}
        </div>
      )}

      {/* 2 — BRIEF */}
      <div className="card brief">
        <Sparkles size={16} style={{color:'#7B3F00',flexShrink:0}}/>
        <span>{brief}.</span>
      </div>

      {anoms.length>0 && (
        <div className="anom">
          <AlertTriangle size={15} style={{flexShrink:0,marginTop:1}}/>
          <div>{anoms.map((a:any,i:number)=><div key={i}>{a.label}</div>)}</div>
        </div>
      )}

      <div className="dash-cols">
      <div className="dash-main">

      {/* 3 — ATTENTION QUEUE. The theft banner used to be a separate red box above
          this; it's just the top row of the queue now (sev 3). */}
      <div className="card">
        <div className="card-h"><h2><Inbox size={16}/> Needs your attention</h2>
          {totalPending>0 && <span className="badge b-info">{totalPending} open</span>}</div>
        {queue.length===0
          ? <div className="empty"><CheckCircle2 size={26} style={{color:'var(--ok)',marginBottom:8}}/><div>All clear — nothing needs you right now.</div></div>
          : <table><tbody>
              {queue.map(q=>(
                <tr key={q.key} style={{cursor:'pointer'}} onClick={()=>go(q.go,q.qp)}>
                  <td style={{width:38}}><q.Icon size={17} style={{color:q.sev>=3?'var(--danger)':'var(--cta)'}}/></td>
                  <td style={{fontWeight:600}}>{q.label}</td>
                  <td className="right"><span className={'badge '+(q.sev>=3?'b-danger':'b-warn')}>{q.n}</span></td>
                  <td className="right" style={{width:120}}>
                    <button className="btn sm ghost">Review <ArrowRight size={12} style={{verticalAlign:-1}}/></button>
                  </td>
                </tr>
              ))}
            </tbody></table>}
      </div>

      {/* 4 — LIVE STRIP (60s) + the six KPIs that actually move */}
      <div className="pulse">
        {[
          { lab:'Online now', val:pulse?.online_now, Icon:Activity, hot:true },
          { lab:'Signups today', val:pulse?.signups_today, Icon:UserPlus },
          { lab:'Listings today', val:pulse?.listings_today, Icon:ListChecks },
          { lab:'Chats today', val:counts.chats_today, Icon:MessagesSquare },
          { lab:'Msgs / hour', val:pulse?.messages_hour, Icon:Radio },
        ].map(p=>(
          <div key={p.lab} className="p-item">
            <p.Icon size={13} style={{color:p.hot?'var(--ok)':'var(--muted)'}}/>
            <span className="p-val">{p.val??'—'}</span>
            <span className="p-lab">{p.lab}</span>
            {p.hot && <span className="p-dot"/>}
          </div>
        ))}
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

      {/* 5 — ONE geography panel. "Most active districts" and "Users by district"
          both lived here too and answered the same question; the drill-down
          (state → district → listings) already covers them. */}
      <div className="card">
        <div className="card-h"><h2><MapIcon size={16}/> Where your users are</h2>
          <button className="btn sm ghost" onClick={()=>go('analytics',{tab:'liquidity'})}>Supply gaps <ArrowRight size={12} style={{verticalAlign:-1}}/></button>
        </div>
        <div className="heatgrid">
          {Object.entries(HEAT_AREAS).map(([state,area])=>{
            const n=stateTotals[state]||0;
            return (
              <button key={state} className="heatcell" title={`See ${state} districts`}
                onClick={()=>setDrill({level:'districts',state,prev:null})}
                style={{gridArea:area,
                background:`rgba(186,117,23,${0.08+0.55*(n/heatMax)})`,
                color:n/heatMax>0.55?'#fff':'var(--ink)'}}>
                <div className="h-n">{n}</div>
                <div className="h-s">{state}</div>
              </button>
            );
          })}
          <button className="heatcell rest" title="See other states"
            onClick={()=>setDrill({level:'states',prev:null})}
            style={{gridArea:'rest',background:`rgba(186,117,23,${0.08+0.55*(Math.min(restTotal,heatMax)/heatMax)})`,
              color:restTotal/heatMax>0.55?'#fff':'var(--ink)'}}>
            <span className="h-n">{restTotal}</span>
            <span className="h-s">Rest of India{restStates.length?` · ${restStates.length} state${restStates.length>1?'s':''}`:''}</span>
          </button>
        </div>
        <div style={{padding:'0 18px 12px',fontSize:12}} className="muted">
          Top districts: {regions.filter(r=>r.district).slice(0,4).map(r=>`${r.district} ${r.n}`).join(' · ')||'—'}
        </div>
      </div>
      </div>{/* /dash-main */}

      {/* 6 — Live event stream (30s poll) */}
      <aside className="dash-feed">
        <div className="card" style={{position:'sticky',top:14}}>
          <div className="card-h"><h2><Radio size={15}/> Happening now</h2>
            {newSince>0 && <span className="badge b-info">{newSince} new</span>}
            <span className="p-dot"/></div>
          <div className="feedlist">
            {feed.length===0
              ? <div className="empty" style={{padding:'24px 12px'}}>Quiet right now — new signups, listings, receipts and alerts stream in here.</div>
              : feed.map((e:any,idx:number)=>{
                  const m=FEED_META[e.kind]||FEED_META.listing;
                  return (
                    <div key={e.kind+e.id}>
                      {/* One divider, at the point your last visit ended. */}
                      {idx===newSince && newSince>0 && <div className="feedmark">↑ since you last looked</div>}
                      <div className="feedrow">
                        <m.Icon size={14} style={{color:m.c,flexShrink:0,marginTop:2}}/>
                        <div style={{minWidth:0}}>
                          <div className="f-t">
                            {e.kind==='signup' ? <UserLink id={e.id}>{e.title}</UserLink>
                              : e.kind==='listing' ? <ListingLink id={e.id}>{e.title}</ListingLink>
                              : e.kind==='receipt' ? <ReceiptLink id={e.id}>{e.title}</ReceiptLink>
                              : e.title}
                          </div>
                          <div className="f-s">{e.kind} · {e.subtitle} · {timeAgo(e.at)}</div>
                        </div>
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
      {open360 && <Listing360 listingId={open360} onClose={()=>setOpen360(null)} onChanged={loadSlow}/>}
    </>
  );
}
