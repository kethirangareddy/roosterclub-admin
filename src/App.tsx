import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import {
  LayoutDashboard, Inbox, Stethoscope, BookOpen, Bird, Siren,
  Rocket, Users as UsersIcon, Truck, Store, Egg, Star, Megaphone, Gavel, Flag, ShieldCheck, Award, Trophy, TrendingUp, BarChart3, MessagesSquare, SlidersHorizontal, Search, Wallet, History as HistoryIcon
} from 'lucide-react';
import CommandK, { Hit } from './CommandK';
import Money from './sections/Money';
import Activity from './sections/Activity';
import UserDetail from './sections/UserDetail';
import Listing360 from './sections/Listing360';
import Receipt360 from './sections/Receipt360';
import AppConfig from './sections/AppConfig';
import Login from './Login';
import Featured from './sections/Featured';
import Dashboard from './sections/Dashboard';
import Analytics from './sections/Analytics';
import Community from './sections/Community';
import Approvals from './sections/Approvals';
import Vets from './sections/Vets';
import Kukuta from './sections/Kukuta';
import Breeds from './sections/Breeds';
import Disease from './sections/Disease';
import Boosts from './sections/Boosts';
import UsersSection from './sections/UsersSection';
import LiveFeed from './sections/LiveFeed';
import Shop from './sections/Shop';
import Announcements from './sections/Announcements';
import Auctions from './sections/Auctions';
import Reports from './sections/Reports';
import Kyc from './sections/Kyc';
import BadgeRequests from './sections/BadgeRequests';
import Competitions from './sections/Competitions';
import Acquisition from './sections/Acquisition';

type Key = 'dash'|'analytics'|'money'|'activity'|'approvals'|'reports'|'kyc'|'badges'|'competitions'|'acquisition'|'featured'|'livefeed'|'shop'|'vets'|'kukuta'|'breeds'|'disease'|'boosts'|'users'|'announce'|'auctions'|'community'|'appconfig';

const NAV: { key:Key; label:string; Icon:any }[] = [
  { key:'dash', label:'Dashboard', Icon:LayoutDashboard },
  { key:'analytics', label:'Analytics', Icon:BarChart3 },
  { key:'money', label:'Money Desk', Icon:Wallet },
  { key:'approvals', label:'Approvals', Icon:Inbox },
  { key:'reports', label:'Reports', Icon:Flag },
  { key:'kyc', label:'Verifications', Icon:ShieldCheck },
  { key:'badges', label:'Badge Requests', Icon:Award },
  { key:'competitions', label:'Competitions', Icon:Trophy },
  { key:'featured', label:'Featured', Icon:Star },
  { key:'livefeed', label:'Live Feed', Icon:Truck },
  { key:'shop', label:'Shop', Icon:Store },
  { key:'vets', label:'Doctors', Icon:Stethoscope },
  { key:'auctions', label:'Auctions', Icon:Gavel },
  { key:'kukuta', label:'Kukuta Shastram', Icon:BookOpen },
  { key:'breeds', label:'Breed Encyclopedia', Icon:Bird },
  { key:'disease', label:'Disease Alerts', Icon:Siren },
  { key:'announce', label:'Announcements', Icon:Megaphone },
  { key:'boosts', label:'Boosts', Icon:Rocket },
  { key:'users', label:'Users & Badges', Icon:UsersIcon },
  { key:'community', label:'Community', Icon:MessagesSquare },
  { key:'acquisition', label:'Acquisition', Icon:TrendingUp },
  { key:'activity', label:'Activity', Icon:HistoryIcon },
  { key:'appconfig', label:'App Config', Icon:SlidersHorizontal },
];

const KEYS = NAV.map(n=>n.key);
// g + letter → jump to a section from anywhere (Gmail-style).
const GNAV: Record<string,Key> = {
  d:'dash', n:'analytics', a:'approvals', r:'reports', k:'kyc', b:'badges',
  f:'featured', s:'shop', u:'users', c:'community', x:'auctions', m:'announce', o:'appconfig',
  y:'money', v:'activity',
};

// What each ⌘K hit opens: users/listings/receipts get a 360 modal, the rest jump to their section.
type Detail = { kind:'user'|'listing'|'receipt'; id:string };

export default function App(){
  const [session,setSession]=useState<Session|null>(null);
  const [isAdmin,setIsAdmin]=useState<boolean|null>(null);
  const [view,setViewRaw]=useState<Key>(()=>{
    const v=new URLSearchParams(location.search).get('view') as Key|null;
    return v && KEYS.includes(v) ? v : 'dash';
  });
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [menuOpen,setMenuOpen]=useState(false);
  const [cmdk,setCmdk]=useState(false);
  const [detail,setDetail]=useState<Detail[]>([]); // stack: Receipt-360 → seller 360 etc.

  function openHit(h:Hit){
    setCmdk(false);
    if(h.kind==='user'||h.kind==='listing'||h.kind==='receipt') setDetail([{ kind:h.kind, id:h.id }]);
    else if(h.kind==='auction') setView('auctions');
    else if(h.kind==='report') setView('reports');
  }
  const pushDetail=(d:Detail)=>setDetail(s=>[...s,d]);
  const popDetail=()=>setDetail(s=>s.slice(0,-1));

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
    const u=new URL(location.href);
    const keep=k==='dash'?null:k;
    u.search=''; if(keep) u.searchParams.set('view',keep);
    if(qp) Object.entries(qp).forEach(([key,val])=>u.searchParams.set(key,val));
    history.pushState(null,'',u);
  }
  useEffect(()=>{
    const onPop=()=>{
      const v=new URLSearchParams(location.search).get('view') as Key|null;
      setViewRaw(v && KEYS.includes(v) ? v : 'dash');
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

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const { data:sub }=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return ()=>sub.subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session){ setIsAdmin(null); return; }
    supabase.from('admins').select('id').eq('id',session.user.id).maybeSingle()
      .then(({data})=>setIsAdmin(!!data));
  },[session]);

  async function refreshCounts(){
    // Parallel — these were 9 sequential round-trips, making the sidebar counts crawl.
    try {
    const [pendL,pendF,pendD,pendFeat,pendV,pendA,pendR,pendK,pendB]=await Promise.all([
      supabase.from('listings').select('id',{count:'exact',head:true}).eq('approval_status','pending'),
      supabase.from('live_feed_sellers').select('id',{count:'exact',head:true}).eq('approved',false),
      supabase.from('disease_alerts').select('id',{count:'exact',head:true}).eq('verified',false),
      supabase.from('feature_requests').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase.from('vets').select('id',{count:'exact',head:true}).eq('approved',false),
      supabase.from('auctions').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase.from('reports').select('id',{count:'exact',head:true}).eq('status','open'),
      supabase.from('kyc_submissions').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase.from('badge_requests').select('id',{count:'exact',head:true}).eq('status','pending'),
    ]);
    setCounts({ approvals:pendL.count||0, reports:pendR.count||0, kyc:pendK.count||0, badges:pendB.count||0, featured:pendFeat.count||0, livefeed:pendF.count||0, disease:pendD.count||0, vets:pendV.count||0, auctions:pendA.count||0 });
    } catch (e) {
      // Keep the last known counts — a transient network blip shouldn't blank the sidebar.
      console.error('refreshCounts failed:', e);
    }
  }
  useEffect(()=>{ if(isAdmin) refreshCounts(); },[isAdmin,view]);

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
    dash:<Dashboard go={setView}/>, analytics:<Analytics/>,
    money:<Money openReceipt={(id:string)=>setDetail([{kind:'receipt',id}])} go={setView}/>,
    activity:<Activity/>,
    approvals:<Approvals onChange={refreshCounts}/>,
    reports:<Reports onChange={refreshCounts}/>, kyc:<Kyc onChange={refreshCounts}/>,
    badges:<BadgeRequests onChange={refreshCounts}/>,
    competitions:<Competitions/>,
    acquisition:<Acquisition/>,
    featured:<Featured onChange={refreshCounts}/>,
    livefeed:<LiveFeed onChange={refreshCounts}/>, shop:<Shop/>, vets:<Vets onChange={refreshCounts}/>,
    kukuta:<Kukuta/>, breeds:<Breeds/>, disease:<Disease onChange={refreshCounts}/>,
    boosts:<Boosts/>, users:<UsersSection/>, announce:<Announcements/>, auctions:<Auctions onChange={refreshCounts}/>,
    community:<Community onChange={refreshCounts}/>,
    appconfig:<AppConfig/>,
  };

  const top=detail[detail.length-1];

  return (
    <div className="shell">
      <button className="menu-btn" onClick={()=>setMenuOpen(true)} aria-label="Open menu">☰</button>
      {menuOpen && <div className="nav-scrim" onClick={()=>setMenuOpen(false)}/>}
      <aside className={menuOpen?'side open':'side'}>
        <div className="brand"><Egg size={22}/> Rooster Club</div>
        <button className="cmdk-launch" onClick={()=>{setCmdk(true);setMenuOpen(false);}}>
          <Search size={14}/> Search anything… <span className="cmdk-kbd">⌘K</span>
        </button>
        <nav className="nav">
          {NAV.map(({key,label,Icon})=>(
            <button key={key} className={view===key?'active':''} onClick={()=>{setView(key);setMenuOpen(false);}}>
              <Icon size={18}/> {label}
              {!!counts[key] && <span className="count">{counts[key]}</span>}
            </button>
          ))}
        </nav>
        <div className="who">
          <div className="kbd-hint" title="g then d/a/r/k… jumps sections · j/k moves the focused row · a approve, r reject">⌨ g+key jump · j/k rows · a/r act</div>
          {session.user.email}
          <div><button onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
        </div>
      </aside>
      <main className="main">{sections[view]}</main>

      {cmdk && <CommandK onOpenResult={openHit} onClose={()=>setCmdk(false)}/>}
      {top?.kind==='user' && <UserDetail userId={top.id} onClose={popDetail}/>}
      {top?.kind==='listing' && <Listing360 listingId={top.id} onClose={popDetail}
        onOpenUser={(id)=>pushDetail({kind:'user',id})} onChanged={refreshCounts}/>}
      {top?.kind==='receipt' && <Receipt360 receiptId={top.id} onClose={popDetail}
        onOpenUser={(id)=>pushDetail({kind:'user',id})} onOpenListing={(id)=>pushDetail({kind:'listing',id})}/>}
    </div>
  );
}
