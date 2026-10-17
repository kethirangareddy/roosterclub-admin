import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import {
  LayoutDashboard, Inbox, ListChecks, Stethoscope, BookOpen, Bird, Siren, ShieldAlert,
  Rocket, Users as UsersIcon, Truck, Store, Star, Megaphone, Gavel, Flag, ShieldCheck, Award, Trophy, BarChart3, MessagesSquare, SlidersHorizontal, Search, Wallet, History as HistoryIcon, Shield, ChevronDown, ChevronRight,
  Wheat, Settings as SettingsIcon, ShoppingBag, Sun,
} from 'lucide-react';
import { FeedbackHost } from './feedback';
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
import FeedOrders from './sections/FeedOrders';
import Announcements from './sections/Announcements';
import Auctions from './sections/Auctions';
import Reports from './sections/Reports';
import Kyc from './sections/Kyc';
import BadgeRequests from './sections/BadgeRequests';
import WaInbox from './sections/WaInbox';
import Competitions from './sections/Competitions';
import Syndicates from './sections/Syndicates';
import Ads from './sections/Ads';
import Support from './sections/Support';

type Key = 'dash'|'analytics'|'money'|'activity'|'approvals'|'listings'|'reports'|'kyc'|'badges'|'competitions'|'syndicates'|'featured'|'livefeed'|'shop'|'orders'|'feedorders'|'vets'|'kukuta'|'breeds'|'disease'|'theft'|'boosts'|'users'|'announce'|'auctions'|'community'|'chats'|'whatsapp'|'appconfig'|'ads'|'support';

type NavItem = { key:Key; label:string; Icon:any; totalKey?:string };

/* Every screen, with the label used in tabs and search. totalKey → counts.total
   tells us a section has never had a row, so its tab renders dimmed. */
const ITEMS: Record<Key, NavItem> = {
  dash:{ key:'dash', label:'Overview', Icon:LayoutDashboard },
  users:{ key:'users', label:'Members', Icon:UsersIcon },
  kyc:{ key:'kyc', label:'Verifications', Icon:ShieldCheck },
  badges:{ key:'badges', label:'Badge requests', Icon:Award },
  reports:{ key:'reports', label:'Reports', Icon:Flag },
  theft:{ key:'theft', label:'Theft alerts', Icon:ShieldAlert, totalKey:'theft' },
  disease:{ key:'disease', label:'Disease alerts', Icon:Siren, totalKey:'disease' },
  syndicates:{ key:'syndicates', label:'Syndicates', Icon:Shield, totalKey:'syndicates' },
  approvals:{ key:'approvals', label:'Approvals', Icon:Inbox },
  listings:{ key:'listings', label:'Listings', Icon:ListChecks },
  featured:{ key:'featured', label:'Featured', Icon:Star, totalKey:'featured' },
  boosts:{ key:'boosts', label:'Boosts', Icon:Rocket, totalKey:'boosts' },
  ads:{ key:'ads', label:'Ads', Icon:Megaphone },
  auctions:{ key:'auctions', label:'Auctions', Icon:Gavel, totalKey:'auctions' },
  livefeed:{ key:'livefeed', label:'Live feed', Icon:Truck, totalKey:'livefeed' },
  competitions:{ key:'competitions', label:'Competitions', Icon:Trophy, totalKey:'competitions' },
  chats:{ key:'chats', label:'Member chats', Icon:MessagesSquare },
  support:{ key:'support', label:'Support', Icon:MessagesSquare },
  whatsapp:{ key:'whatsapp', label:'WhatsApp', Icon:MessagesSquare },
  community:{ key:'community', label:'Forum', Icon:MessagesSquare, totalKey:'community' },
  announce:{ key:'announce', label:'Broadcasts', Icon:Megaphone },
  shop:{ key:'shop', label:'Products', Icon:Store, totalKey:'shop' },
  orders:{ key:'orders', label:'Orders', Icon:Store, totalKey:'orders' },
  feedorders:{ key:'feedorders', label:'Feed orders', Icon:Wheat },
  analytics:{ key:'analytics', label:'Analytics', Icon:BarChart3 },
  money:{ key:'money', label:'Money', Icon:Wallet },
  activity:{ key:'activity', label:'Audit log', Icon:HistoryIcon },
  appconfig:{ key:'appconfig', label:'App config', Icon:SlidersHorizontal },
  vets:{ key:'vets', label:'Doctors', Icon:Stethoscope, totalKey:'vets' },
  breeds:{ key:'breeds', label:'Breeds', Icon:Bird, totalKey:'breeds' },
  kukuta:{ key:'kukuta', label:'Kukuta', Icon:BookOpen, totalKey:'kukuta' },
};

type HubKey='today'|'people'|'market'|'convos'|'shop'|'insights'|'settings';
type Hub={ key:HubKey; label:string; Icon:any; items:Key[] };
/* Six places to go, plus Settings. Every screen belongs to exactly one hub,
   and inside a hub the screens are tabs across the top. */
export const HUBS: Hub[] = [
  { key:'today', label:'Today', Icon:Sun, items:['dash'] },
  { key:'people', label:'People & Safety', Icon:UsersIcon, items:['users','kyc','badges','reports','theft','disease','syndicates'] },
  { key:'market', label:'Market', Icon:ListChecks, items:['approvals','listings','featured','boosts','ads','auctions','livefeed','competitions'] },
  { key:'convos', label:'Conversations', Icon:MessagesSquare, items:['chats','support','whatsapp','community','announce'] },
  { key:'shop', label:'Shop', Icon:ShoppingBag, items:['orders','feedorders','shop'] },
  { key:'insights', label:'Insights', Icon:BarChart3, items:['analytics','money','activity'] },
  { key:'settings', label:'Settings', Icon:SettingsIcon, items:['appconfig','vets','breeds','kukuta'] },
];
// Only these counts mean "something is waiting for you". admin_counts also
// returns totals like users=1866 — those must never show as a red badge.
const PENDING=new Set<string>(['approvals','kyc','badges','reports','support','theft','disease','syndicates','featured','boosts','auctions','livefeed','orders','feedorders','vets','community']);
const hubOf=(k:Key)=>HUBS.find(h=>h.items.includes(k))||HUBS[0];
const NAV: NavItem[] = Object.values(ITEMS);
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
  {key:'support',label:'Support',Icon:MessagesSquare},
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
  {key:'feedorders',label:'Feed orders',Icon:Wheat},
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
    if(push) history.pushState({rcDetail:next.length},'',u); else history.replaceState(history.state,'',u);
  }

  function openHit(h:Hit){
    setCmdk(false);
    if(h.kind==='user'||h.kind==='listing'||h.kind==='receipt') commitDetail([{ kind:h.kind, id:h.id }],true);
    else if(h.kind==='auction') setView('auctions');
    else if(h.kind==='report') setView('reports');
  }
  // Tapping the thing that's already open does nothing (it used to stack a
  // second copy, so Close appeared not to work).
  const pushDetail=(d:Detail)=>{
    const t=detail[detail.length-1];
    if(t && t.kind===d.kind && t.id===d.id) return;
    commitDetail([...detail,d],true);
  };
  // Closing a panel we opened = one step Back, so the phone's Back button and
  // the ✕ agree. (Closing used to leave a dead history entry: the next Back
  // press did nothing, the one after jumped to a different screen.)
  const popDetail=()=>{
    if(history.state?.rcDetail===detail.length) history.back();
    else commitDetail(detail.slice(0,-1),false);
  };

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
    try{ localStorage.setItem('rc_hub_'+hubOf(k).key,k); }catch{}
    window.scrollTo(0,0);
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
    const [{ data, error }, sup]=await Promise.all([
      supabase.rpc('admin_counts'),
      supabase.rpc('admin_support_unread'),
    ]);
    // Keep the last known counts — a transient blip shouldn't blank the sidebar.
    if(error){ console.error('refreshCounts failed:', error.message); return; }
    setCounts({ ...((data as any)||{}), support: sup.error ? 0 : Number(sup.data)||0 });
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
    money:<Money openReceipt={(id:string)=>detailApi.openReceipt(id)} go={setView}/>,
    activity:<Activity/>,
    approvals:<Approvals onChange={refreshCounts}/>,
    listings:<Listings/>,
    reports:<Reports onChange={refreshCounts}/>, kyc:<Kyc onChange={refreshCounts}/>,
    badges:<BadgeRequests onChange={refreshCounts}/>,
    competitions:<Competitions/>,
    syndicates:<Syndicates onChange={refreshCounts}/>,
    featured:<Featured onChange={refreshCounts}/>,
    livefeed:<LiveFeed onChange={refreshCounts}/>, shop:<Shop/>, orders:<Orders/>, feedorders:<FeedOrders/>, vets:<Vets onChange={refreshCounts}/>,
    kukuta:<Kukuta/>, breeds:<Breeds/>, disease:<Disease onChange={refreshCounts}/>,
    boosts:<Boosts/>, users:<UsersSection/>, announce:<Announcements/>, auctions:<Auctions onChange={refreshCounts}/>,
    community:<Community onChange={refreshCounts}/>,
    chats:<Chats/>,
    support:<Support onChange={refreshCounts}/>,
    whatsapp:<WaInbox/>,
    ads:<Ads/>,
    theft:<Theft onChange={refreshCounts}/>,
    appconfig:<AppConfig/>,
  };

  const top=detail[detail.length-1];
  const hub=hubOf(view);
  const pend=(k:string)=>PENDING.has(k)?(Number(counts[k])||0):0;
  const hubPending=(h:Hub)=>h.items.reduce((n,k)=>n+pend(k),0);
  // Tapping a hub lands on the screen that needs you most, else the one you
  // used last in that hub, else its first screen.
  function openHub(h:Hub){
    const hot=h.items.filter(k=>pend(k)>0).sort((a,b)=>pend(b)-pend(a))[0];
    let last:Key|null=null; try{ last=localStorage.getItem('rc_hub_'+h.key) as Key|null; }catch{}
    setView(hot || (last && h.items.includes(last) ? last : h.items[0]));
  }

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
          {HUBS.filter(h=>h.key!=='settings').map(h=>{
            const n=hubPending(h);
            return (
              <button key={h.key} className={hub.key===h.key?'active':''} onClick={()=>{openHub(h);setMenuOpen(false);}}>
                <h.Icon size={18}/> {h.label}
                {n>0 && <span className="count">{n}</span>}
              </button>
            );
          })}
          <div className="nav-sep"/>
          {(()=>{ const h=HUBS.find(x=>x.key==='settings')!; const n=hubPending(h); return (
            <button className={hub.key==='settings'?'active':''} onClick={()=>{openHub(h);setMenuOpen(false);}}>
              <h.Icon size={18}/> {h.label}{n>0 && <span className="count">{n}</span>}
            </button>
          ); })()}
        </nav>
        <div className="who">
          <div className="kbd-hint" title="g then d/a/r/k… jumps sections · j/k moves the focused row · a approve, r reject">⌨ g+key jump · j/k rows · a/r act</div>
          {session.user.email}
          <div><button onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
        </div>
      </aside>
      <main className="main">
        {hub.items.length>1 && (
          <div className="hubbar">
            <div className="hubbar-t"><hub.Icon size={16}/> {hub.label}</div>
            <div className="hubtabs" role="tablist">
              {hub.items.map(k=>{
                const it=ITEMS[k]; const n=pend(k);
                const empty=it.totalKey ? !(counts.total?.[it.totalKey]) : false;
                return (
                  <button key={k} role="tab" aria-selected={view===k}
                    className={'hubtab'+(view===k?' on':'')+(empty&&view!==k?' empty':'')}
                    title={empty?'Nothing here yet':undefined} onClick={()=>setView(k)}>
                    {it.label}{n>0 && <span className="count">{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {view==='dash' && <MobileTriage counts={counts} go={(k)=>setView(k)}/>}
        <div key={view} className="page">{sections[view]}</div>
      </main>

      {/* Thumb-reachable bottom bar (phones only) for the most-used sections. */}
      <nav className="btabs">
        {HUBS.filter(h=>['today','people','market','convos'].includes(h.key)).map(h=>{
          const n=hubPending(h);
          return (
            <button key={h.key} className={hub.key===h.key?'on':''} onClick={()=>openHub(h)}>
              <h.Icon size={20}/>{n>0&&<i className="bdot">{n>99?'99+':n}</i>}
              <span>{h.key==='people'?'People':h.key==='convos'?'Chats':h.label}</span>
            </button>
          );
        })}
        <button onClick={()=>setMenuOpen(true)}><SettingsIcon size={20}/><span>More</span></button>
      </nav>

      {cmdk && <CommandK onOpenResult={openHit}
        onGo={(v,qp)=>{ setCmdk(false); setView(v as Key,qp); }}
        onClose={()=>setCmdk(false)}/>}
      {/* key = kind+id+depth: opening user B from inside user A must mount a
          fresh panel. Without it React reused A's panel and kept A's photos,
          KYC and stats on screen under B's name. */}
      {top?.kind==='user' && <UserDetail key={'u'+top.id+detail.length} userId={top.id} onClose={popDetail}/>}
      {top?.kind==='listing' && <Listing360 key={'l'+top.id+detail.length} listingId={top.id} onClose={popDetail}
        onOpenUser={(id)=>pushDetail({kind:'user',id})} onChanged={refreshCounts}/>}
      {top?.kind==='receipt' && <Receipt360 key={'r'+top.id+detail.length} receiptId={top.id} onClose={popDetail}
        onOpenUser={(id)=>pushDetail({kind:'user',id})} onOpenListing={(id)=>pushDetail({kind:'listing',id})}/>}
      <FeedbackHost/>
    </div>
    </DetailCtx.Provider>
  );
}
