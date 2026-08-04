import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Users as UsersIcon, Search, ShieldCheck, Eye, ShieldAlert, CopyX, Award } from 'lucide-react';
import { Empty, Loading, loc, timeAgo, useParamState, WaButton, FOUNDER_CAP, UserLink } from '../ui';
import UserDetail from './UserDetail';

const BADGES:{v:string;label:string}[]=[
  {v:'',label:'No badge'},
  {v:'founding_member',label:'Founding Member'},
  {v:'bronze',label:'Bronze'},
  {v:'silver',label:'Silver'},
  {v:'gold_star',label:'Gold Star'},
  {v:'legendary',label:'Legendary'},
];

/** Item 12 — risk chip: 0–100 from reports + account age + KYC + velocity + shared UPI. */
export function RiskChip({ n }:{ n:number }){
  const cls = n>=60?'b-danger':n>=30?'b-warn':'b-mut';
  return <span className={'badge '+cls} title="reports · account age · KYC · listing velocity · shared UPI">{n}</span>;
}

export default function UsersSection(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [q,setQ]=useState('');
  const [viewId,setViewId]=useState<string|null>(null);
  // Items 12–14: All (created desc) | High risk (auto-flag queue) | Duplicates (ban evasion)
  const [tab,setTab]=useParamState<'all'|'risk'|'dups'>('tab','all');
  const [dups,setDups]=useState<any[]>([]);
  const [fState,setFState]=useState<string>('all'); // location filters (All users tab)
  const [fDist,setFDist]=useState<string>('all');
  const [fCred,setFCred]=useState<'all'|'has'>('all'); // feature-credits filter (All users tab)
  const [fOnline,setFOnline]=useState<'all'|'online'>('all'); // online filter (All users tab)
  const [fRef,setFRef]=useState<'all'|'referred'|'referrer'>('all'); // referral filter (All users tab)
  // Founder's Badge is capped at 100 (DB trigger trg_founder_badge_cap); show what's left.
  const [founders,setFounders]=useState<{issued:number;remaining:number}|null>(null);
  // How many rows we asked the DB for, and how many actually match. admin_users
  // used to hard-cap at 200 and report that as the total — never trust rows.length.
  const [lim,setLim]=useState(1000);
  const [total,setTotal]=useState<number|null>(null);

  async function load(){
    setLoading(true);
    if(tab==='dups'){
      const { data, error }=await supabase.rpc('admin_duplicates');
      if(error) alert('Could not load duplicates: '+error.message);
      setDups(data||[]); setLoading(false); return;
    }
    if(tab==='risk'){
      const { data, error }=await supabase.rpc('admin_flagged_users');
      if(error) alert('Could not load flagged users: '+error.message);
      setRows(data||[]); setLoading(false); return;
    }
    const { data, error }=await supabase.rpc('admin_users',{ p_q: q.trim()||null, p_sort:'new', p_limit: lim, p_offset: 0 });
    if(error) alert('Could not load users: '+error.message);
    let list = data||[];
    // total_n is a window count computed before LIMIT — the real match count.
    setTotal(list.length ? Number(list[0].total_n) : 0);
    // Merge referral info (who invited them + how many they invited) so the
    // list can filter by referral. Additive RPC — keeps admin_users unchanged.
    const { data:refs }=await supabase.rpc('admin_user_referrals');
    if(refs){
      const m=new Map<string,any>((refs as any[]).map(r=>[r.id,r]));
      list=list.map((u:any)=>{ const r=m.get(u.id); return r?{...u,referred_by:r.referred_by,referred_count:r.referred_count}:u; });
    }
    // Merge each user's app language so the WhatsApp message pre-fills in Telugu
    // or English to match what they actually read.
    const ids=list.map((u:any)=>u.id).filter(Boolean);
    if(ids.length){
      const { data:langs }=await supabase.from('users').select('id,language').in('id',ids);
      if(langs){
        const lm=new Map<string,string>((langs as any[]).map(r=>[r.id,r.language]));
        list=list.map((u:any)=>({...u, language:lm.get(u.id)||null}));
      }
    }
    setRows(list); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab,lim]);

  // Founder's Badge counter — refreshed whenever a badge changes below.
  async function loadFounders(){
    const { data }=await supabase.rpc('founder_badge_stats');
    const r=Array.isArray(data)?data[0]:data;
    if(r) setFounders({ issued:r.issued, remaining:r.remaining });
  }
  useEffect(()=>{ loadFounders(); },[]);

  async function setBadge(id:string, badge:string){
    // badge_source:'admin' protects a hand-set badge from the nightly earned-badge cron; clearing the badge clears the source too (lets the auto-system take over again).
    const { error }=await supabase.from('users')
      .update({ badge:badge||null, badge_source:badge?'admin':null, badge_awarded_at:badge?new Date().toISOString():null }).eq('id',id);
    if(error){
      // trg_founder_badge_cap rejects the 101st Founder's Badge.
      alert(/cap reached/i.test(error.message)
        ? `All ${FOUNDER_CAP} Founder's Badges have been issued — this one can't be given.`
        : 'Could not save badge: '+error.message);
      return;
    }
    setRows(r=>r.map(x=>x.id===id?{...x,badge:badge||null}:x));
    loadFounders();
  }
  async function toggleBan(u:any){
    if(!confirm(u.banned?'Unban this user?':'Ban this user?')) return;
    const { error }=await supabase.from('users').update({ banned:!u.banned }).eq('id',u.id);
    if(error){ alert('Could not update: '+error.message); return; }
    setRows(r=>r.map(x=>x.id===u.id?{...x,banned:!u.banned}:x));
  }

  // Online = seen within 5 min (matches the Command Center pulse "online now").
  const isOnline = (u:any)=> !!u.last_seen_at && (Date.now()-new Date(u.last_seen_at).getTime()) < 5*60*1000;

  // Location filters for the All-users list (client-side over the loaded rows).
  const uStates = Array.from(new Set(rows.map(u=>u.state).filter(Boolean))).sort();
  const uDists = Array.from(new Set(rows.filter(u=>fState==='all'||u.state===fState).map(u=>u.district).filter(Boolean))).sort();
  const shown = rows.filter(u=> (fState==='all'||u.state===fState) && (fDist==='all'||u.district===fDist) && (fCred==='all' || (u.bonus_feature_credits||0)>0) && (fOnline==='all' || isOnline(u)) && (fRef==='all' || (fRef==='referred' && !!u.referred_by) || (fRef==='referrer' && (u.referred_count||0)>0)));

  return (
    <>
      <h1 className="h1">Users &amp; Badges</h1>
      <p className="sub">Badges, bans, and the fraud sweep — high-risk accounts and duplicate clusters surface here.</p>
      {founders && (
        <div className="card" style={{padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <Award size={16} style={{color:'var(--cta)'}}/>
          <b>Founder's Badge</b>
          <span className={'badge '+(founders.remaining===0?'b-danger':founders.remaining<=10?'b-warn':'b-ok')}>
            {founders.issued} of {FOUNDER_CAP} issued · {founders.remaining} left
          </span>
          <span className="muted" style={{fontSize:11.5}}>
            {founders.remaining===0
              ? 'Cap reached — the database will refuse any further Founder’s Badges.'
              : 'Capped in the database, so the 101st can never be issued by mistake.'}
          </span>
        </div>
      )}
      <div className="tabbar">
        <button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>All users</button>
        <button className={tab==='risk'?'active':''} onClick={()=>setTab('risk')}><ShieldAlert size={13} style={{verticalAlign:-2}}/> High risk</button>
        <button className={tab==='dups'?'active':''} onClick={()=>setTab('dups')}><CopyX size={13} style={{verticalAlign:-2}}/> Duplicates</button>
      </div>

      {tab==='dups' ? (
        <div className="card">
          <div className="card-h"><h2><CopyX size={16}/> Duplicate &amp; ban-evasion clusters ({dups.length})</h2></div>
          {loading?<Loading/>:dups.length===0?<Empty text="No suspicious clusters — no shared UPI ids, no same-day referral bursts."/>:(
            <table>
              <thead><tr><th>Pattern</th><th>Key</th><th>Accounts</th></tr></thead>
              <tbody>
                {dups.map((d,i)=>(
                  <tr key={i}>
                    <td><span className={'badge '+(d.kind==='shared-upi'?'b-danger':'b-warn')}>{d.kind==='shared-upi'?'Same UPI':'Referral burst'}</span></td>
                    <td className="muted" style={{fontFamily:'monospace',fontSize:12}}>{d.dkey}</td>
                    <td>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {(d.members||[]).map((u:any)=>(
                          <button key={u.id} className="btn ghost sm" onClick={()=>setViewId(u.id)}>
                            {u.name||('@'+(u.handle||'user'))}{u.banned?' · banned':''}
                            <span className="muted" style={{marginLeft:4,fontSize:11}}>{u.district||''} · {timeAgo(u.created_at)}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : tab==='risk' ? (
        <div className="card">
          <div className="card-h"><h2><ShieldAlert size={16}/> Flagged users ({rows.length})</h2></div>
          {loading?<Loading/>:rows.length===0?<Empty text="No flagged users — nobody crosses risk ≥ 60 or 3+ reports."/>:(
            <table>
              <thead><tr><th>Risk</th><th>Name</th><th>Handle</th><th>Open reports</th><th>Reports 24h</th><th>Shared UPI</th><th></th></tr></thead>
              <tbody>
                {rows.map(u=>(
                  <tr key={u.id}>
                    <td><RiskChip n={u.risk}/></td>
                    <td style={{fontWeight:600}}><UserLink id={u.id}>{u.full_name||'View user'}</UserLink></td>
                    <td className="muted"><UserLink id={u.id}>{u.handle?'@'+u.handle:'—'}</UserLink></td>
                    <td>{u.open_reports||0}</td>
                    <td>{u.reports_24h||0}</td>
                    <td>{u.shared_upi?<span className="badge b-danger">yes</span>:<span className="badge b-mut">—</span>}</td>
                    <td className="right"><button className="btn ghost sm" onClick={()=>setViewId(u.id)}><Eye size={13}/> View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
      <div className="card">
        <div className="card-h">
          <h2><UsersIcon size={16}/> Users ({shown.length}
            {total!=null && shown.length!==total && <span className="muted" style={{fontWeight:400}}> of {total}</span>})
            {total!=null && rows.length<total && (
              <button className="btn ghost sm" style={{marginLeft:8}} onClick={()=>setLim(l=>l+1000)}
                title={`Only ${rows.length} of ${total} matching users are loaded`}>
                Load {Math.min(1000, total-rows.length)} more
              </button>
            )}
          </h2>
          <div className="toolbar">
            <input placeholder="Search name, handle, phone…" value={q}
              onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} style={{width:240}}/>
            <button className="btn ghost sm" onClick={load}><Search size={14}/> Search</button>
            <select value={fState} onChange={e=>{setFState(e.target.value);setFDist('all');}} style={{fontSize:13,padding:'6px 8px',borderRadius:8}} title="Filter by state">
              <option value="all">All states</option>
              {uStates.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select value={fDist} onChange={e=>setFDist(e.target.value)} style={{fontSize:13,padding:'6px 8px',borderRadius:8}} title="Filter by district">
              <option value="all">All districts</option>
              {uDists.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            <select value={fCred} onChange={e=>setFCred(e.target.value as 'all'|'has')} style={{fontSize:13,padding:'6px 8px',borderRadius:8}} title="Filter by feature credits">
              <option value="all">All credits</option>
              <option value="has">Has credits</option>
            </select>
            <select value={fOnline} onChange={e=>setFOnline(e.target.value as 'all'|'online')} style={{fontSize:13,padding:'6px 8px',borderRadius:8}} title="Filter by online status">
              <option value="all">All users</option>
              <option value="online">Online now</option>
            </select>
            <select value={fRef} onChange={e=>setFRef(e.target.value as 'all'|'referred'|'referrer')} style={{fontSize:13,padding:'6px 8px',borderRadius:8}} title="Filter by referral">
              <option value="all">All referrals</option>
              <option value="referred">Joined via referral</option>
              <option value="referrer">Referred others</option>
            </select>
          </div>
        </div>
        {loading?<Loading/>:shown.length===0?<Empty text="No users found."/>:(
          <table>
            <thead><tr><th>User</th><th>Phone</th><th>Risk</th><th>Badge</th><th></th><th></th><th></th></tr></thead>
            <tbody>
              {shown.map(u=>(
                <tr key={u.id} style={u.banned?{opacity:.55}:undefined}>
                  {/* Compact identity cell — tap View for KYC photos, stats & history. */}
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                      <UserLink id={u.id}><b>{u.full_name||(u.handle?'@'+u.handle:'—')}</b></UserLink>
                      {u.aadhaar_verified&&<span title="KYC verified" style={{display:'inline-flex',color:'var(--ok)'}}><ShieldCheck size={13}/></span>}
                      {u.banned&&<span className="badge b-danger">Banned</span>}
                    </div>
                    <div className="muted" style={{fontSize:11.5,marginTop:2}}>
                      {u.handle?'@'+u.handle:'no handle'}
                      {loc(u)&&loc(u)!=='—'?' · '+loc(u):''}
                      {isOnline(u)
                        ? <span style={{color:'var(--ok)',fontWeight:600}}> · ● Online</span>
                        : (u.last_seen_at?' · '+timeAgo(u.last_seen_at):'')}
                      {(u.bonus_feature_credits||0)>0?' · ✦'+u.bonus_feature_credits+' credits':''}
                      {u.referred_by?' · via referral':''}
                      {(u.referred_count||0)>0?' · invited '+u.referred_count:''}
                    </div>
                  </td>
                  {/* Phone in the open (admin-only RPC) + one tap to WhatsApp with the
                      Founder's Badge message pre-filled in this user's language. */}
                  <td style={{whiteSpace:'nowrap'}}>
                    <span style={{fontFamily:'monospace',fontSize:12.5}}>{u.phone||'—'}</span>
                    {u.language==='te' && <span className="badge b-mut" style={{marginLeft:6,fontSize:10}}>తె</span>}
                  </td>
                  <td><RiskChip n={u.risk||0}/></td>
                  <td>
                    <select value={u.badge||''} onChange={e=>setBadge(u.id,e.target.value)}>
                      {BADGES.map(b=><option key={b.v} value={b.v}>{b.label}</option>)}
                    </select>
                  </td>
                  <td><WaButton phone={u.phone} lang={u.language}/></td>
                  <td><button className="btn ghost sm" onClick={()=>setViewId(u.id)}><Eye size={13}/> View</button></td>
                  <td><button className={'btn sm '+(u.banned?'ghost':'danger')} onClick={()=>toggleBan(u)}>{u.banned?'Unban':'Ban'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}
      {viewId && <UserDetail userId={viewId} onClose={()=>setViewId(null)}/>}
    </>
  );
}
