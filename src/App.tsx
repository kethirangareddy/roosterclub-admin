import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import {
  LayoutDashboard, Inbox, Stethoscope, BookOpen, Bird, Siren,
  Rocket, Users as UsersIcon, Truck, Store, Egg, Star, Megaphone, Gavel, Flag
} from 'lucide-react';
import Login from './Login';
import Featured from './sections/Featured';
import Dashboard from './sections/Dashboard';
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

type Key = 'dash'|'approvals'|'reports'|'featured'|'livefeed'|'shop'|'vets'|'kukuta'|'breeds'|'disease'|'boosts'|'users'|'announce'|'auctions';

const NAV: { key:Key; label:string; Icon:any }[] = [
  { key:'dash', label:'Dashboard', Icon:LayoutDashboard },
  { key:'approvals', label:'Approvals', Icon:Inbox },
  { key:'reports', label:'Reports', Icon:Flag },
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
];

export default function App(){
  const [session,setSession]=useState<Session|null>(null);
  const [isAdmin,setIsAdmin]=useState<boolean|null>(null);
  const [view,setView]=useState<Key>('dash');
  const [counts,setCounts]=useState<Record<string,number>>({});

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
    const pendL=await supabase.from('listings').select('id',{count:'exact',head:true}).eq('approval_status','pending');
    const pendF=await supabase.from('live_feed_sellers').select('id',{count:'exact',head:true}).eq('approved',false);
    const pendD=await supabase.from('disease_alerts').select('id',{count:'exact',head:true}).eq('verified',false);
    const pendFeat=await supabase.from('feature_requests').select('id',{count:'exact',head:true}).eq('status','pending');
    const pendV=await supabase.from('vets').select('id',{count:'exact',head:true}).eq('approved',false);
    const pendA=await supabase.from('auctions').select('id',{count:'exact',head:true}).eq('status','pending');
    const pendR=await supabase.from('reports').select('id',{count:'exact',head:true}).eq('status','open');
    setCounts({ approvals:pendL.count||0, reports:pendR.count||0, featured:pendFeat.count||0, livefeed:pendF.count||0, disease:pendD.count||0, vets:pendV.count||0, auctions:pendA.count||0 });
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
    dash:<Dashboard go={setView}/>, approvals:<Approvals onChange={refreshCounts}/>,
    reports:<Reports onChange={refreshCounts}/>,
    featured:<Featured onChange={refreshCounts}/>,
    livefeed:<LiveFeed onChange={refreshCounts}/>, shop:<Shop/>, vets:<Vets onChange={refreshCounts}/>,
    kukuta:<Kukuta/>, breeds:<Breeds/>, disease:<Disease onChange={refreshCounts}/>,
    boosts:<Boosts/>, users:<UsersSection/>, announce:<Announcements/>, auctions:<Auctions onChange={refreshCounts}/>,
  };

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><Egg size={22}/> Rooster Club</div>
        <nav className="nav">
          {NAV.map(({key,label,Icon})=>(
            <button key={key} className={view===key?'active':''} onClick={()=>setView(key)}>
              <Icon size={18}/> {label}
              {!!counts[key] && <span className="count">{counts[key]}</span>}
            </button>
          ))}
        </nav>
        <div className="who">
          {session.user.email}
          <div><button onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
        </div>
      </aside>
      <main className="main">{sections[view]}</main>
    </div>
  );
}
