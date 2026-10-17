import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';

/* Load a screen on first visit. If a deploy happened while this tab was open,
   the old screen file no longer exists — reload once to pick up the new app
   instead of showing a blank screen. */
function lazyScreen(load:()=>Promise<any>){
  return lazy(()=>load().catch(err=>{
    if(navigator.onLine && !sessionStorage.getItem('rc_chunk_reload')){ sessionStorage.setItem('rc_chunk_reload','1'); location.reload(); }
    throw err;
  }).then(m=>{ sessionStorage.removeItem('rc_chunk_reload'); return m; }));
}
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import {
  LayoutDashboard, Inbox, ListChecks, Stethoscope, BookOpen, Bird, Siren, ShieldAlert,
  Rocket, Users as UsersIcon, Truck, Store, Star, Megaphone, Gavel, Flag, ShieldCheck, Award, Trophy, BarChart3, MessagesSquare, SlidersHorizontal, Search, Wallet, History as HistoryIcon, Shield, ChevronDown, ChevronRight,
  Wheat, Settings as SettingsIcon, ShoppingBag, Sun,
} from 'lucide-react';
import { FeedbackHost } from './feedback';
import { DrawerCtx } from './ui';
import { ChevronLeft, X } from 'lucide-react';
const KIND_LABEL={user:'Member',listing:'Listing',receipt:'Receipt'} as const;
import CommandK, { Hit } from './CommandK';
import { DetailCtx, decodeDetail, encodeDetail, useOnChanged, type Detail } from './detail';
const Money = lazyScreen(() => import('./sections/Money'));
const Activity = lazyScreen(() => import('./sections/Activity'));
import UserDetail from './sections/UserDetail';
import Listing360 from './sections/Listing360';
import Receipt360 from './sections/Receipt360';
const AppConfig = lazyScreen(() => import('./sections/AppConfig'));
import Login from './Login';
import ResetPassword from './ResetPassword';
const Featured = lazyScreen(() => import('./sections/Featured'));
import Dashboard from './sections/Dashboard';
const Analytics = lazyScreen(() => import('./sections/Analytics'));
const Community = lazyScreen(() => import('./sections/Community'));
const Chats = lazyScreen(() => import('./sections/Chats'));
const Theft = lazyScreen(() => import('./sections/Theft'));
const Approvals = lazyScreen(() => import('./sections/Approvals'));
const Listings = lazyScreen(() => import('./sections/Listings'));
const Vets = lazyScreen(() => import('./sections/Vets'));
const Kukuta = lazyScreen(() => import('./sections/Kukuta'));
const Breeds = lazyScreen(() => import('./sections/Breeds'));
const Disease = lazyScreen(() => import('./sections/Disease'));
const Boosts = lazyScreen(() => import('./sections/Boosts'));
const UsersSection = lazyScreen(() => import('./sections/UsersSection'));
const LiveFeed = lazyScreen(() => import('./sections/LiveFeed'));
const Shop = lazyScreen(() => import('./sections/Shop'));
const Orders = lazyScreen(() => import('./sections/Orders'));
const FeedOrders = lazyScreen(() => import('./sections/FeedOrders'));
const Announcements = lazyScreen(() => import('./sections/Announcements'));
const Auctions = lazyScreen(() => import('./sections/Auctions'));
const Reports = lazyScreen(() => import('./sections/Reports'));
const Kyc = lazyScreen(() => import('./sections/Kyc'));
const BadgeRequests = lazyScreen(() => import('./sections/BadgeRequests'));
const WaInbox = lazyScreen(() => import('./sections/WaInbox'));
const Competitions = lazyScreen(() => import('./sections/Competitions'));
const Syndicates = lazyScreen(() => import('./sections/Syndicates'));
const Ads = lazyScreen(() => import('./sections/Ads'));
const Support = lazyScreen(() => import('./sections/Support'));

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
// (No forum count exists yet, so Forum never shows a badge rather than a fake 0.)
const PENDING=new Set<string>(['approvals','kyc','badges','reports','support','theft','disease','syndicates','featured','boosts','auctions','livefeed','orders','feedorders','vets']);
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
const TRIAGE: {key:string;label:string;Icon:any;view?:Key;qp?:Record<string,string>}[]=[
  {key:'flagged',label:'High risk',Icon:ShieldAlert,view:'users',qp:{tab:'risk'}},
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
  {key:'vets',label:'Doctors',Icon:Stethoscope},
];
function MobileTriage({counts,go,status,retry}:{counts:Record<string,any>;go:(k:Key,qp?:Record<string,string>)=>void;status:'loading'|'ok'|'error';retry:()=>void}){
  // Never say "all clear" before the numbers are in, or when they failed to load.
  if(status!=='ok') return (
    <div className="mtriage mobile-only">
      <div className="mtriage-h">Today</div>
      {status==='loading' ? <div className="mtriage-clear">Loading…</div>
        : <div className="mtriage-clear">Couldn't load what's waiting. <button className="btn ghost sm" onClick={retry}>Retry</button></div>}
    </div>
  );
  const items=TRIAGE.filter(i=>(counts[i.key]||0)>0).sort((a,b)=>(counts[b.key]||0)-(counts[a.key]||0));
  const pending=items.reduce((n,i)=>n+(counts[i.key]||0),0);
  return (
    <div className="mtriage mobile-only">
      <div className="mtriage-h">Today · {pending>0?`${pending} pending`:'all clear'}</div>
      {items.length===0
        ? <div className="mtriage-clear">Nothing needs you right now.</div>
        : <div className="mtriage-grid">
            {items.map(({key,label,Icon,view,qp})=>(
              <button key={key} className="mtile" onClick={()=>go((view||key) as Key,qp)}>
                <Icon size={20}/>
                <span className="mtile-l">{label}</span>
                <span className="mtile-n hot">{counts[key]}</span>
              </button>
            ))}
          </div>}
    </div>
  );
}

/* Light / Dark / Auto. Auto follows the device and switches live. */
type ThemePref='auto'|'light'|'dark';
function useTheme(){
  const [pref,setPref]=useState<ThemePref>(()=>{ try{ return (localStorage.getItem('rc_theme') as ThemePref)||'auto'; }catch{ return 'auto'; } });
  useEffect(()=>{
    const m=window.matchMedia('(prefers-color-scheme: dark)');
    const apply=()=>{
      const dark=pref==='dark'||(pref==='auto'&&m.matches);
      document.documentElement.dataset.theme=dark?'dark':'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#17110C':'#BA7517');
    };
    apply(); m.addEventListener('change',apply);
    try{ localStorage.setItem('rc_theme',pref); }catch{}
    return ()=>m.removeEventListener('change',apply);
  },[pref]);
  return [pref,setPref] as const;
}

/* If a screen fails to load or crashes, show a Retry card for that screen
   only — the menu and everything else keep working. */
class ScreenBoundary extends Component<{children:ReactNode},{err:Error|null}>{
  state={err:null as Error|null};
  static getDerivedStateFromError(err:Error){ return {err}; }
  componentDidCatch(err:Error){ console.error('Screen crashed:',err); }
  render(){
    if(!this.state.err) return this.props.children;
    return (
      <div className="card" style={{padding:24,textAlign:'center'}}>
        <div style={{fontWeight:700,marginBottom:6}}>This screen didn't load.</div>
        <div className="muted" style={{fontSize:13,marginBottom:14}}>{navigator.onLine?'Something went wrong while opening it.':'You seem to be offline.'}</div>
        <button className="btn" onClick={()=>{ sessionStorage.removeItem('rc_chunk_reload'); location.reload(); }}>Retry</button>
      </div>
    );
  }
}

function useOnline(){
  const [on,setOn]=useState(()=>navigator.onLine);
  useEffect(()=>{ const u=()=>setOn(true), d=()=>setOn(false);
    window.addEventListener('online',u); window.addEventListener('offline',d);
    return ()=>{ window.removeEventListener('online',u); window.removeEventListener('offline',d); }; },[]);
  return on;
}

export default function App(){
  const online=useOnline();
  const [themePref,setThemePref]=useTheme();
  const [session,setSession]=useState<Session|null>(null);
  const [isAdmin,setIsAdmin]=useState<boolean|null>(null);
  const [accessErr,setAccessErr]=useState(false);
  const [accessTry,setAccessTry]=useState(0);
  // Survives a reload (pull-to-refresh, tab discarded) until the new password is saved.
  const [recovery,setRecovery]=useState(()=>{ try{ return sessionStorage.getItem('rc_recovery')==='1'; }catch{ return false; } });
  const [recoveryBad,setRecoveryBad]=useState(false);
  const [view,setViewRaw]=useState<Key>(()=>{
    const v=new URLSearchParams(location.search).get('view') as Key|null;
    return v && KEYS.includes(v) ? v : 'dash';
  });
  const [counts,setCounts]=useState<Record<string,any>>({});
  const [menuOpen,setMenuOpen]=useState(false);
  const [cmdk,setCmdk]=useState(false);
  const [navTick,setNavTick]=useState(0);
  // stack: Receipt-360 → seller 360 etc. Mirrored to ?d= so a 360 survives a
  // refresh, can be shared as a link, and closes on browser Back.
  const [detail,setDetail]=useState<Detail[]>(()=>decodeDetail(new URLSearchParams(location.search).get('d')));

  /** Write the stack to the URL. Opening pushes (Back closes); closing replaces. */
  function commitDetail(next:Detail[], push:boolean){
    setDetail(next);
    const u=new URL(location.href);
    if(next.length) u.searchParams.set('d',encodeDetail(next)); else u.searchParams.delete('d');
    if(push){
      // rcBase = how many panels were open before we started pushing (e.g. a
      // shared ?d= link). We never go Back past that — it would leave the app.
      const st=history.state;
      const base=st?.rcDetail!=null ? (st.rcBase??0) : detail.length;
      history.pushState({...(st||{}),rcDetail:next.length,rcBase:base},'',u);
    } else history.replaceState(history.state,'',u);
  }

  function openHit(h:Hit){
    setCmdk(false);
    if(h.kind==='user'||h.kind==='listing'||h.kind==='receipt') pushDetail({ kind:h.kind, id:h.id });
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
  const popDetail=()=>popTo(detail.length-2);
  /** Go back to breadcrumb level i (-1 = close the panel). */
  // While a Back is in flight, extra taps on ✕ / Esc / Back are ignored —
  // otherwise a double-tap went back twice and left the screen (or the app).
  const navigating=useRef(false);
  const popTarget=useRef<number|null>(null);
  function popTo(i:number){
    if(navigating.current) return;
    const steps=detail.length-1-i;
    if(steps<=0) return;
    const st=history.state;
    const ours=st?.rcDetail===detail.length ? detail.length-(st.rcBase??0) : 0;
    const k=Math.min(steps,ours);
    if(k<=0){ commitDetail(detail.slice(0,i+1),false); return; }
    navigating.current=true;
    setTimeout(()=>{ navigating.current=false; },1000); // safety net
    popTarget.current=i; // finish the rest after the Back lands (see onPop)
    history.go(-k);
  }
  const closeAllDetail=()=>popTo(-1);
  // Breadcrumb names: each panel reports its own title once loaded.
  const [titles,setTitles]=useState<Record<number,string>>({});
  useEffect(()=>{ if(!detail.length) setTitles({}); },[detail.length]);

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
    function onKey(e:KeyboardEvent){ if(e.key==='Escape' && !e.defaultPrevented && !document.querySelector('.drawer .scrim, .ask-scrim, .cmdk, .zoom-scrim')){ e.preventDefault(); popDetail(); } }
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
    setViewRaw(k); setNavTick(n=>n+1);
    try{ localStorage.setItem('rc_hub_'+hubOf(k).key,k); }catch{}
    window.scrollTo(0,0);
    setDetail([]); // the URL is about to lose ?d= — drop the stack with it
    const u=new URL(location.href);
    const keep=k==='dash'?null:k;
    u.search=''; if(keep) u.searchParams.set('view',keep);
    if(qp) Object.entries(qp).forEach(([key,val])=>u.searchParams.set(key,val));
    // Re-tapping the screen you're on refreshes it without adding a Back step.
    // A thread open in Member chats has its own Back step: re-tapping the
    // screen steps back over it instead of leaving a dead Back press.
    if(k===view && !qp && !detail.length && (history.state?.rcChat||history.state?.rcSel)){ history.back(); return; }
    if(k===view && !qp && !detail.length) history.replaceState(null,'',u); else history.pushState(null,'',u);
  }
  useEffect(()=>{
    const onPop=()=>{
      const p=new URLSearchParams(location.search);
      const v=p.get('view') as Key|null;
      setViewRaw(v && KEYS.includes(v) ? v : 'dash');
      let d=decodeDetail(p.get('d')); // Back closes / reopens the 360 stack
      navigating.current=false;
      const t=popTarget.current; popTarget.current=null;
      if(t!==null && d.length>t+1){
        // Went back as far as our own entries go; trim the rest in place.
        d=d.slice(0,t+1);
        const u=new URL(location.href);
        if(d.length) u.searchParams.set('d',encodeDetail(d)); else u.searchParams.delete('d');
        history.replaceState(history.state,'',u);
      }
      setDetail(d);
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
      if(document.querySelector('.scrim, .drawer-scrim, .ask-scrim')) return;
      if(pending){
        // The key after "g" belongs to navigation, whatever it is: mark it
        // handled so row shortcuts (a approve / r reject) never also fire on it.
        pending=false; clearTimeout(timer); e.preventDefault();
        setTimeout(()=>{ (window as any).__gnav=false; },0);
        const target=GNAV[e.key.toLowerCase()];
        if(target) setView(target);
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
    // isAdmin too: on first load <main> doesn't exist until the admin check
    // finishes, so phone tables never got their "Label: value" rows until you
    // changed screens.
  },[view,isAdmin]);

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
    if(h.get('error_code') || h.get('error')){
      // Supabase sends expired / already-used links back as #error=…
      setRecoveryBad(true); setRecovery(true);
      history.replaceState(null,'',window.location.pathname+window.location.search);
      return;
    }
    if(h.get('type')==='recovery' && h.get('access_token')){
      supabase.auth.setSession({
        access_token: h.get('access_token')!,
        refresh_token: h.get('refresh_token')||'',
      }).then(({error})=>{
        (window as any).__rcNoReload=true; // keep the reset screen through an app update
        if(error){ setRecoveryBad(true); } // expired / already used link
        else { try{ sessionStorage.setItem('rc_recovery','1'); }catch{} }
        setRecovery(true);
      }).finally(()=>{
        history.replaceState(null,'',window.location.pathname+window.location.search);
      });
    }
  },[]);

  useEffect(()=>{
    if(!session){ setIsAdmin(null); return; }
    // A failed check (offline, blip) is NOT "not an admin" — show Retry instead.
    setAccessErr(false);
    supabase.from('admins').select('id').eq('id',session.user.id).maybeSingle()
      .then(({data,error})=>{ if(error){ setAccessErr(true); return; } setIsAdmin(!!data); });
  },[session,accessTry]);

  // One RPC instead of 11 count round-trips. It also carries the per-table
  // totals the "More" group uses to dim sections that have no rows, and the
  // headline numbers the dashboard used to re-count for itself.
  const countsReq=useRef(0);
  // Any action anywhere (⌘K, a side panel) refreshes the waiting badges right away.
  useOnChanged(()=>{ if(isAdmin) refreshCounts(); });
  const [countsStatus,setCountsStatus]=useState<'loading'|'ok'|'error'>('loading');
  async function refreshCounts(){
    const my=++countsReq.current; // an older, slower reply must not overwrite newer counts
    const [{ data, error }, sup, feed, shop]=await Promise.all([
      supabase.rpc('admin_counts'),
      supabase.rpc('admin_support_unread'),
      // admin_counts has no feed-order number, so count the ones that need you here.
      supabase.from('custom_feed_orders').select('id',{ count:'exact', head:true })
        .in('status',['payment_review','paid','milling','packed']),
      // Shop orders waiting on YOU (not unpaid UPI orders waiting on the buyer).
      supabase.from('shop_orders').select('id',{ count:'exact', head:true })
        .in('status',['payment_review','pending','confirmed','packed']),
    ]);
    // Keep the last known counts — a transient blip shouldn't blank the sidebar.
    if(my!==countsReq.current) return;
    if(error){ console.error('refreshCounts failed:', error.message); setCountsStatus(s=>s==='ok'?'ok':'error'); return; }
    setCountsStatus('ok');
    // If only the support count failed, keep the last known number — a failure is not "0 unread".
    setCounts(prev=>({ ...((data as any)||{}),
      support: sup.error ? (prev.support??0) : Number(sup.data)||0,
      feedorders: feed.error ? (prev.feedorders??0) : (feed.count??0),
      orders: shop.error ? (prev.orders??(data as any)?.orders??0) : (shop.count??0) }));
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

  if(recovery) return <ResetPassword expired={recoveryBad} onDone={()=>{
    (window as any).__rcNoReload=false; try{ sessionStorage.removeItem('rc_recovery'); }catch{}
    setRecoveryBad(false); setRecovery(false);
  }}/>;
  if(!session) return <Login/>;
  if(isAdmin===null) return <div className="login"><div className="box">{accessErr
    ? <>Can't reach the server{online?'':' — you are offline'}.<div style={{marginTop:12}}><button className="btn" onClick={()=>setAccessTry(n=>n+1)}>Retry</button></div></>
    : 'Checking access…'}</div></div>;
  if(isAdmin===false) return (
    <div className="login"><div className="box">
      <div className="logo">Access denied</div>
      <p>{session.user.email} is not an admin.</p>
      <button className="btn" onClick={()=>supabase.auth.signOut()}>Sign out</button>
    </div></div>
  );

  const sections:Record<Key,JSX.Element>={
    dash:<Dashboard go={setView} counts={counts} countsFailed={countsStatus==='error'} retryCounts={refreshCounts}/>, analytics:<Analytics/>,
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
          <div className="theme-tg" role="radiogroup" aria-label="Theme">
            {(['light','auto','dark'] as const).map(t=>(
              <button key={t} role="radio" aria-checked={themePref===t} className={themePref===t?'on':''} onClick={()=>setThemePref(t)}>
                {t==='light'?'Light':t==='dark'?'Dark':'Auto'}
              </button>
            ))}
          </div>
          <div className="kbd-hint" title="g then d/a/r/k… jumps sections · j/k moves the focused row · a approve, r reject">⌨ g+key jump · j/k rows · a/r act</div>
          {session.user.email}
          <div><button onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
        </div>
      </aside>
      <main className="main">
        {!online && <div className="offline">You're offline — numbers on screen may be out of date. Changes won't save until you're back.</div>}
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
        {view==='dash' && <MobileTriage counts={counts} go={(k,qp)=>setView(k,qp)} status={countsStatus} retry={refreshCounts}/>}
        {/* Screens load on first visit (the app used to download all 34 up front). */}
        <div key={view+':'+navTick} className="page"><ScreenBoundary><Suspense fallback={<div className="loading">Loading…</div>}>{sections[view]}</Suspense></ScreenBoundary></div>
      </main>

      {/* Thumb-reachable bottom bar (phones only) for the most-used sections. */}
      <nav className="btabs">
        {HUBS.filter(h=>['today','people','market','convos'].includes(h.key)).map(h=>{
          const n=hubPending(h);
          return (
            <button key={h.key} className={hub.key===h.key?'on':''} onClick={()=>{ openHub(h); setMenuOpen(false); }}>
              <h.Icon size={20}/>{n>0&&<i className="bdot">{n>99?'99+':n}</i>}
              <span>{h.key==='people'?'People':h.key==='convos'?'Chats':h.label}</span>
            </button>
          );
        })}
        <button onClick={()=>setMenuOpen(true)}><SettingsIcon size={20}/><span>More</span></button>
      </nav>

      {cmdk && <CommandK onOpenResult={openHit}
        screens={NAV.map(it=>({ view:it.key, label:it.label, hub:hubOf(it.key).label, Icon:it.Icon }))}
        onGo={(v,qp)=>{ setCmdk(false); setView(v as Key,qp); }}
        onClose={()=>setCmdk(false)}/>}
      {/* One side panel for every user / listing / receipt. Opening something
          from inside it adds a breadcrumb step instead of a new popup. */}
      {top && (
        <div className="drawer-scrim" onClick={closeAllDetail}>
          <aside className="drawer" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}>
            <div className="drawer-h">
              {detail.length>1 && <button className="drawer-back" onClick={popDetail} aria-label="Back"><ChevronLeft size={18}/></button>}
              <div className="drawer-crumbs">
                {detail.slice(0,-1).map((d,i)=>(
                  <button key={i} className="crumb" onClick={()=>popTo(i)}>{titles[i]||KIND_LABEL[d.kind]}</button>
                ))}
                <span className="crumb now">{titles[detail.length-1]||KIND_LABEL[top.kind]}</span>
              </div>
              <button className="x" onClick={closeAllDetail} aria-label="Close"><X size={20}/></button>
            </div>
            {/* key = kind+id+depth: opening user B from inside user A must mount
                a fresh panel, never A's with B's name on it. */}
            <DrawerCtx.Provider key={top.kind+top.id+detail.length} value={{ setTitle:(t)=>setTitles(m=>({...m,[detail.length-1]:t})) }}>
              <div className="drawer-scroll">
                {top.kind==='user' && <UserDetail userId={top.id} onClose={popDetail}/>}
                {top.kind==='listing' && <Listing360 listingId={top.id} onClose={popDetail}
                  onOpenUser={(id)=>pushDetail({kind:'user',id})} onChanged={refreshCounts}/>}
                {top.kind==='receipt' && <Receipt360 receiptId={top.id} onClose={popDetail}
                  onOpenUser={(id)=>pushDetail({kind:'user',id})} onOpenListing={(id)=>pushDetail({kind:'listing',id})}/>}
              </div>
            </DrawerCtx.Provider>
          </aside>
        </div>
      )}
      <FeedbackHost/>
    </div>
    </DetailCtx.Provider>
  );
}
