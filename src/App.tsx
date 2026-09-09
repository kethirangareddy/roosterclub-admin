import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import {
  LayoutDashboard, Inbox, ListChecks, Stethoscope, BookOpen, Bird, Siren, ShieldAlert,
  Rocket, Users as UsersIcon, Truck, Store, Star, Megaphone, Gavel, Flag, ShieldCheck, Award, Trophy, BarChart3, MessagesSquare, SlidersHorizontal, Search, Wallet, History as HistoryIcon, Shield, ChevronDown, ChevronRight
} from 'lucide-react';
import CommandK, { Hit } from './CommandK';
import { DetailCtx, decodeDetail, encodeDetail, type Detail } from './detail';
import Money from './sections/Money';
import Activity from './sections/Activity';
import UserDetail from './sections/UserDetail';
import Listing360 from './sections/Listing360';
import Receipt360 from './sections/Receipt360';
import AppConfig from './sections/AppConfig';
import Login from './Login';
import ResetPassword from './ResetPassword';
import Featured from './sections/Featured';
import Dashboard from './sections/Dashboard';
import Analytics from './sections/Analytics';
import Community from './sections/Community';
import Chats from './sections/Chats';
import Theft from './sections/Theft';
import Approvals from './sections/Approvals';
import Listings from './sections/Listings';
import Vets from './sections/Vets';
import Kukuta from './sections/Kukuta';
import Breeds from './sections/Breeds';
import Disease from './sections/Disease';
import Boosts from './sections/Boosts';
import UsersSection from './sections/UsersSection';
import LiveFeed from './sections/LiveFeed';
import Shop from './sections/Shop';
import Orders from './sections/Orders';
import Announcements from './sections/Announcements';
import Auctions from './sections/Auctions';
import Reports from './sections/Reports';
import Kyc from './sections/Kyc';
import BadgeRequests from './sections/BadgeRequests';
import Competitions from './sections/Competitions';
import Syndicates from './sections/Syndicates';

type Key = 'dash'|'analytics'|'money'|'activity'|'approvals'|'listings'|'reports'|'kyc'|'badges'|'competitions'|'syndicates'|'featured'|'livefeed'|'shop'|'orders'|'vets'|'kukuta'|'breeds'|'disease'|'theft'|'boosts'|'users'|'announce'|'auctions'|'community'|'chats'|'appconfig';

type NavItem = { key:Key; label:string; Icon:any; totalKey?:string };

// Nav is for places you GO. The attention queue is for things that NEED you —
// so a queue that is empty earns no permanent slot up here; it gets promoted
// into the dashboard queue the moment it has an item. CORE is what's open every
// day; everything else lives behind "More", dimmed when its table is empty.
const CORE: NavItem[] = [
  { key:'dash', label:'Dashboard', Icon:LayoutDashboard },
  { key:'analytics', label:'Analytics', Icon:BarChart3 },
  { key:'approvals', label:'Approvals', Icon:Inbox },
  { key:'listings', label:'Listings', Icon:ListChecks },
  { key:'users', label:'Users & Badges', Icon:UsersIcon },
  { key:'kyc', label:'Verifications', Icon:ShieldCheck },
  { key:'badges', label:'Badge Requests', Icon:Award },
  { key:'reports', label:'Reports', Icon:Flag },
  { key:'chats', label:'Chats', Icon:MessagesSquare },
  { key:'announce', label:'Announcements', Icon:Megaphone },
  { key:'activity', label:'Activity', Icon:HistoryIcon },
  { key:'appconfig', label:'App Config', Icon:SlidersHorizontal },
];

// totalKey → counts.total.<key>; 0 rows renders the item dimmed ("nothing here yet")
// instead of pretending to be a live section.
const MORE: NavItem[] = [
  { key:'money', label:'Money Desk', Icon:Wallet },
  { key:'theft', label:'Theft Alerts', Icon:ShieldAlert, totalKey:'theft' },
  { key:'disease', label:'Disease Alerts', Icon:Siren, totalKey:'disease' },
  { key:'syndicates', label:'Syndicates', Icon:Shield, totalKey:'syndicates' },
  { key:'competitions', label:'Competitions', Icon:Trophy, totalKey:'competitions' },
  { key:'featured', label:'Featured', Icon:Star, totalKey:'featured' },
  { key:'boosts', label:'Boosts', Icon:Rocket, totalKey:'boosts' },
  { key:'auctions', label:'Auctions', Icon:Gavel, totalKey:'auctions' },
  { key:'livefeed', label:'Live Feed', Icon:Truck, totalKey:'livefeed' },
  { key:'shop', label:'Shop', Icon:Store, totalKey:'shop' },
  { key:'orders', label:'Orders', Icon:Store, totalKey:'orders' },
  { key:'vets', label:'Doctors', Icon:Stethoscope, totalKey:'vets' },
  { key:'community', label:'Community', Icon:MessagesSquare, totalKey:'community' },
  { key:'kukuta', label:'Kukuta', Icon:BookOpen, totalKey:'kukuta' },
  { key:'breeds', label:'Breeds', Icon:Bird, totalKey:'breeds' },
];

const NAV: NavItem[] = [...CORE, ...MORE];
const KEYS = NAV.map(n=>n.key);
// g + letter → jump to a section from anywhere (Gmail-style).
const GNAV: Record<string,Key> = {
  d:'dash', n:'analytics', a:'approvals', r:'reports', k:'kyc', b:'badges',
  f:'featured', s:'shop', u:'users', c:'community', x:'auctions', m:'announce', o:'appconfig',
  y:'money', v:'activity', t:'theft', l:'listings',
};

// What each ⌘K hit opens: users/listings/receipts get a 360 modal, the rest jump
// to their section. The stack + open* helpers live in ./detail so any section can
// reach them through context instead of prop-drilling.

// Mobile home: a "Today" grid of the queues that need attention, each a big
// tap target that jumps straight into that section. Hidden on desktop via CSS.
// Was a hardcoded 8-tile grid that showed a row of zeros for queues that have
// never had an item. Now it mirrors the desktop attention queue: only what's
// actually pending, ranked, biggest first.
const TRIAGE: {key:Key;label:string;Icon:any}[]=[
  {key:'approvals',label:'Approvals',Icon:Inbox},
  {key:'kyc',label:'Verify',Icon:ShieldCheck},
  {key:'badges',label:'Badges',Icon:Award},
  {key:'reports',label:'Reports',Icon:Flag},
  {key:'syndicates',label:'Syndicates',Icon:Shield},
  {key:'theft',label:'Theft',Icon:ShieldAlert},
  {key:'disease',label:'Disease',Icon:Siren},
  {key:'featured',label:'Featured',Icon:Star},
  {key:'boosts',label:'Boosts',Icon:Rocket},
  {key:'auctions',label:'Auctions',Icon:Gavel},
  {key:'livefeed',label:'Live feed',Icon:Truck},
  {key:'orders',label:'Orders',Icon:Store},
];
function MobileTriage({counts,go}:{counts:Record<string,any>;go:(k:Key)=>void}){
  const items=TRIAGE.filter(i=>(counts[i.key]||0)>0).sort((a,b)=>(counts[b.key]||0)-(counts[a.key]||0));
  const pending=items.reduce((n,i)=>n+(counts[i.key]||0),0);
  return (
    <div className="mtriage mobile-only">
      <div className="mtriage-h">Today · {pending>0?`${pending} pending`:'all clear'}</div>
      {items.length===0
        ? <div className="mtriage-clear">Nothing needs you right now.</div>
        : <div className="mtriage-grid">
            {items.map(({key,label,Icon})=>(
              <button key={key} className="mtile" onClick={()=>go(key)}>
                <Icon size={20}/>
                <span className="mtile-l">{label}</span>
                <span className="mtile-n hot">{counts[key]}</span>
              </button>
            ))}
          </div>}
    </div>
  );
}

export default function App(){
  const [session,setSession]=useState<Session|null>(null);
  const [isAdmin,setIsAdmin]=useState<boolean|null>(null);
  const [recovery,setRecovery]=useState(false);
  const [view,setViewRaw]=useState<Key>(()=>{
    const v=new URLSearchParams(location.search).get('view') as Key|null;
    return v && KEYS.includes(v) ? v : 'dash';
  });
  const [counts,setCounts]=useState<Record<string,any>>({});
  const [moreOpen,setMoreOpen]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const [cmdk,setCmdk]=useState(false);
  // stack: Receipt-360 → seller 360 etc. Mirrored to ?d= so a 360 survives a
  // refresh, can be shared as a link, and closes on browser Back.
  const [detail,setDetail]=useState<Detail[]>(()=>decodeDetail(new URLSearchParams(location.search).get('d')));

  /** Write the stack to the URL. Opening pushes (Back closes); closing replaces. */
  function commitDetail(next:Detail[], push:boolean){
    setDetail(next);
    const u=new URL(location.href);
    if(next.length) u.searchParams.set('d',encodeDetail(next)); else u.searchParams.delete('d');
    if(push) history.pushState(null,'',u); else history.replaceState(null,'',u);
  }

  function openHit(h:Hit){
    setCmdk(false);
    if(h.kind==='user'||h.kind==='listing'||h.kind==='receipt') commitDetail([{ kind:h.kind, id:h.id }],true);
    else if(h.kind==='auction') setView('auctions');
    else if(h.kind==='report') setView('reports');
  }
  const pushDetail=(d:Detail)=>commitDetail([...detail,d],true);
  const popDetail=()=>commitDetail(detail.slice(0,-1),false);

  // What every section calls. Ignores empty ids so a missing seller_id can't
  // open a blank modal.
  const detailApi={
    openUser:(id?:string|null)=>{ if(id) pushDetail({kind:'user',id:String(id)}); },
    openListing:(id?:string|null)=>{ if(id) pushDetail({kind:'listing',id:String(id)}); },
    openReceipt:(id?:string|null)=>{ if(id) pushDetail({kind:'receipt',id:String(id)}); },
    go:(key:string,qp?:Record<string,string>)=>setView(key as Key,qp),
  };

  // Esc closes the top 360 (matches the scrim click).
  useEffect(()=>{
    if(!detail.length) return;
    function onKey(e:KeyboardEvent){ if(e.key==='Escape'){ e.preventDefault(); popDetail(); } }
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[detail]);

  // ⌘K / Ctrl+K opens the palette from anywhere.
  useEffect(()=>{
    function onKey(e:KeyboardEvent){
      if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); setCmdk(v=>!v); }
    }
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[]);

  // Saved views: section lives at ?view= so any screen is bookmarkable and
  // back/forward works. Switching sections drops stale filter params.
  function setView(k:Key, qp?:Record<string,string>){
    setViewRaw(k);
    setDetail([]); // the URL is about to lose ?d= — drop the stack with it
    const u=new URL(location.href);
    const keep=k==='dash'?null:k;
    u.search=''; if(keep) u.searchParams.set('view',keep);
    if(qp) Object.entries(qp).forEach(([key,val])=>u.searchParams.set(key,val));
    history.pushState(null,'',u);
  }
  useEffect(()=>{
    const onPop=()=>{
      const p=new URLSearchParams(location.search);
      const v=p.get('view') as Key|null;
      setViewRaw(v && KEYS.includes(v) ? v : 'dash');
      setDetail(decodeDetail(p.get('d'))); // Back closes / reopens the 360 stack
    };
    window.addEventListener('popstate',onPop);
    return ()=>window.removeEventListener('popstate',onPop);
  },[]);

  // Keyboard: press g, then a letter, to jump sections (g d = Dashboard).
  useEffect(()=>{
    let pending=false, timer:any=null;
    function onKey(e:KeyboardEvent){
      const t=e.target as HTMLElement|null;
      if(e.metaKey||e.ctrlKey||e.altKey) return;
      if(t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)) return;
      if(document.querySelector('.scrim')) return;
      if(pending){
        pending=false; clearTimeout(timer); (window as any).__gnav=false;
        const target=GNAV[e.key.toLowerCase()];
        if(target){ e.preventDefault(); setView(target); }
        return;
      }
      if(e.key==='g'){
        pending=true; (window as any).__gnav=true; // row-shortcut hooks stand down
        timer=setTimeout(()=>{ pending=false; (window as any).__gnav=false; },1500);
      }
    }
    window.addEventListener('keydown',onKey);
    return ()=>{ window.removeEventListener('keydown',onKey); clearTimeout(timer); (window as any).__gnav=false; };
  },[]);

  // Mobile: stack tables into cards. Copy each column header into its cells'
  // data-label so CSS can render "Label: value" rows. Re-runs per section and
  // watches async row loads via a MutationObserver — no per-section edits.
  useEffect(()=>{
    const main=document.querySelector('main.main');
    if(!main) return;
    let raf=0;
    const relabel=()=>{
      main.querySelectorAll('table').forEach(tbl=>{
        const heads=Array.from(tbl.querySelectorAll('thead th')).map(th=>(th.textContent||'').trim());
        tbl.querySelectorAll('tbody tr').forEach(tr=>{
          Array.from(tr.children).forEach((td,i)=>{
            const h=heads[i];
            if(h) td.setAttribute('data-label',h); else td.removeAttribute('data-label');
          });
        });
      });
    };
    const schedule=()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(relabel); };
    schedule();
    const mo=new MutationObserver(schedule);
    mo.observe(main,{childList:true,subtree:true});
    return ()=>{ mo.disconnect(); cancelAnimationFrame(raf); };
  },[view]);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const { data:sub }=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return ()=>sub.subscription.unsubscribe();
  },[]);

  // Password-recovery link: the email link lands here with the recovery token in
  // the URL hash. detectSessionInUrl is off, so we parse + establish it ourselves,
  // then show the "set a new password" screen.
  useEffect(()=>{
    const h=new URLSearchParams(window.location.hash.replace(/^#/,''));
    if(h.get('type')==='recovery' && h.get('access_token')){
      supabase.auth.setSession({
        access_token: h.get('access_token')!,
        refresh_token: h.get('refresh_token')||'',
      }).finally(()=>{
        setRecovery(true);
        history.replaceState(null,'',window.location.pathname+window.location.search);
      });
    }
  },[]);

  useEffect(()=>{
    if(!session){ setIsAdmin(null); return; }
    supabase.from('admins').select('id').eq('id',session.user.id).maybeSingle()
      .then(({data})=>setIsAdmin(!!data));
  },[session]);

  // One RPC instead of 11 count round-trips. It also carries the per-table
  // totals the "More" group uses to dim sections that have no rows, and the
  // headline numbers the dashboard used to re-count for itself.
  async function refreshCounts(){
    const { data, error }=await supabase.rpc('admin_counts');
    // Keep the last known counts — a transient blip shouldn't blank the sidebar.
    if(error){ console.error('refreshCounts failed:', error.message); return; }
    setCounts((data as any)||{});
  }
  // Deliberately NOT keyed on `view`: this used to refire 11 queries on every
  // section change (~110 queries per 10 clicks). Sections call refreshCounts()
  // through onChange when they actually mutate a queue.
  useEffect(()=>{
    if(!isAdmin) return;
    refreshCounts();
    const t=setInterval(refreshCounts,120_000);
    return ()=>clearInterval(t);
  },[isAdmin]);

  if(recovery) return <ResetPassword onDone={()=>setRecovery(false)}/>;
  if(!session) return <Login/>;
  if(isAdmin===null) return <div className="login"><div className="box">Checking access…</div></div>;
  if(isAdmin===false) return (
    <div className="login"><div className="box">
      <div className="logo">Access denied</div>
      <p>{session.user.email} is not an admin.</p>
      <button className="btn" onClick={()=>supabase.auth.signOut()}>Sign out</button>
    </div></div>
  );

  const sections:Record<Key,JSX.Element>={
    dash:<Dashboard go={setView} counts={counts}/>, analytics:<Analytics/>,
    money:<Money openReceipt={(id:string)=>setDetail([{kind:'receipt',id}])} go={setView}/>,
    activity:<Activity/>,
    approvals:<Approvals onChange={refreshCounts}/>,
    listings:<Listings/>,
    reports:<Reports onChange={refreshCounts}/>, kyc:<Kyc onChange={refreshCounts}/>,
    badges:<BadgeRequests onChange={refreshCounts}/>,
    competitions:<Competitions/>,
    syndicates:<Syndicates onChange={refreshCounts}/>,
    featured:<Featured onChange={refreshCounts}/>,
    livefeed:<LiveFeed onChange={refreshCounts}/>, shop:<Shop/>, orders:<Orders/>, vets:<Vets onChange={refreshCounts}/>,
    kukuta:<Kukuta/>, breeds:<Breeds/>, disease:<Disease onChange={refreshCounts}/>,
    boosts:<Boosts/>, users:<UsersSection/>, announce:<Announcements/>, auctions:<Auctions onChange={refreshCounts}/>,
    community:<Community onChange={refreshCounts}/>,
    chats:<Chats/>,
    theft:<Theft onChange={refreshCounts}/>,
    appconfig:<AppConfig/>,
  };

  const top=detail[detail.length-1];
  // Pending hiding inside the collapsed group, so nothing goes unnoticed.
  const morePending=MORE.reduce((n,i)=>n+(counts[i.key]||0),0);
  // Stay expanded while you're standing in one of its sections.
  const showMore=moreOpen||MORE.some(i=>i.key===view);

  return (
    <DetailCtx.Provider value={detailApi}>
    <div className="shell">
      <button className="menu-btn" onClick={()=>setMenuOpen(true)} aria-label="Open menu">☰</button>
      {menuOpen && <div className="nav-scrim" onClick={()=>setMenuOpen(false)}/>}
      <aside className={menuOpen?'side open':'side'}>
        <div className="brand"><img className="brand-mark" src="./icon-192.png" alt=""/> Rooster Club</div>
        <button className="cmdk-launch" onClick={()=>{setCmdk(true);setMenuOpen(false);}}>
          <Search size={14}/> Search anything… <span className="cmdk-kbd">⌘K</span>
        </button>
        <nav className="nav">
          {CORE.map(({key,label,Icon})=>(
            <button key={key} className={view===key?'active':''} onClick={()=>{setView(key);setMenuOpen(false);}}>
              <Icon size={18}/> {label}
              {!!counts[key] && <span className="count">{counts[key]}</span>}
            </button>
          ))}
          <button className="nav-more" onClick={()=>setMoreOpen(v=>!v)}>
            {showMore?<ChevronDown size={16}/>:<ChevronRight size={16}/>} More
            {!showMore && morePending>0 && <span className="count">{morePending}</span>}
          </button>
          {showMore && MORE.map(({key,label,Icon,totalKey})=>{
            const empty = totalKey ? !(counts.total?.[totalKey]) : false;
            return (
              <button key={key} className={(view===key?'active':'')+(empty?' nav-empty':'')}
                title={empty?'No rows yet':undefined}
                onClick={()=>{setView(key);setMenuOpen(false);}}>
                <Icon size={18}/> {label}
                {!!counts[key] && <span className="count">{counts[key]}</span>}
              </button>
            );
          })}
        </nav>
        <div className="who">
          <div className="kbd-hint" title="g then d/a/r/k… jumps sections · j/k moves the focused row · a approve, r reject">⌨ g+key jump · j/k rows · a/r act</div>
          {session.user.email}
          <div><button onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
        </div>
      </aside>
      <main className="main">
        {view==='dash' && <MobileTriage counts={counts} go={(k)=>setView(k)}/>}
        {sections[view]}
      </main>

      {/* Thumb-reachable bottom bar (phones only) for the most-used sections. */}
      <nav className="btabs">
        <button className={view==='dash'?'on':''} onClick={()=>setView('dash')}><LayoutDashboard size={20}/><span>Home</span></button>
        <button className={view==='approvals'?'on':''} onClick={()=>setView('approvals')}><Inbox size={20}/>{!!counts.approvals&&<i className="bdot">{counts.approvals}</i>}<span>Approvals</span></button>
        <button className={view==='listings'?'on':''} onClick={()=>setView('listings')}><ListChecks size={20}/><span>Listings</span></button>
        <button className={view==='users'?'on':''} onClick={()=>setView('users')}><UsersIcon size={20}/><span>Users</span></button>
        <button onClick={()=>setCmdk(true)}><Search size={20}/><span>Search</span></button>
      </nav>

      {cmdk && <CommandK onOpenResult={openHit}
        onGo={(v,qp)=>{ setCmdk(false); setView(v as Key,qp); }}
        onClose={()=>setCmdk(false)}/>}
      {top?.kind==='user' && <UserDetail userId={top.id} onClose={popDetail}/>}
      {top?.kind==='listing' && <Listing360 listingId={top.id} onClose={popDetail}
        onOpenUser={(id)=>pushDetail({kind:'user',id})} onChanged={refreshCounts}/>}
      {top?.kind==='receipt' && <Receipt360 receiptId={top.id} onClose={popDetail}
        onOpenUser={(id)=>pushDetail({kind:'user',id})} onOpenListing={(id)=>pushDetail({kind:'listing',id})}/>}
    </div>
    </DetailCtx.Provider>
  );
}
