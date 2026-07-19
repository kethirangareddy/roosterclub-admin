import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Users as UsersIcon, Search, ShieldCheck, Eye, ShieldAlert, CopyX } from 'lucide-react';
import { Empty, Loading, loc, timeAgo, useParamState } from '../ui';
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
    const { data, error }=await supabase.rpc('admin_users',{ p_q: q.trim()||null, p_sort:'new' });
    if(error) alert('Could not load users: '+error.message);
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  async function setBadge(id:string, badge:string){
    // badge_source:'admin' protects a hand-set badge from the nightly earned-badge cron; clearing the badge clears the source too (lets the auto-system take over again).
    const { error }=await supabase.from('users')
      .update({ badge:badge||null, badge_source:badge?'admin':null, badge_awarded_at:badge?new Date().toISOString():null }).eq('id',id);
    if(error){ alert('Could not save badge: '+error.message); return; }
    setRows(r=>r.map(x=>x.id===id?{...x,badge:badge||null}:x));
  }
  async function toggleBan(u:any){
    if(!confirm(u.banned?'Unban this user?':'Ban this user?')) return;
    const { error }=await supabase.from('users').update({ banned:!u.banned }).eq('id',u.id);
    if(error){ alert('Could not update: '+error.message); return; }
    setRows(r=>r.map(x=>x.id===u.id?{...x,banned:!u.banned}:x));
  }

  // Location filters for the All-users list (client-side over the loaded rows).
  const uStates = Array.from(new Set(rows.map(u=>u.state).filter(Boolean))).sort();
  const uDists = Array.from(new Set(rows.filter(u=>fState==='all'||u.state===fState).map(u=>u.district).filter(Boolean))).sort();
  const shown = rows.filter(u=> (fState==='all'||u.state===fState) && (fDist==='all'||u.district===fDist) && (fCred==='all' || (u.bonus_feature_credits||0)>0));

  return (
    <>
      <h1 className="h1">Users &amp; Badges</h1>
      <p className="sub">Badges, bans, and the fraud sweep — high-risk accounts and duplicate clusters surface here.</p>
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
                    <td style={{fontWeight:600}}>{u.full_name||'—'}</td>
                    <td className="muted">{u.handle?'@'+u.handle:'—'}</td>
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
          <h2><UsersIcon size={16}/> Users ({shown.length})</h2>
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
          </div>
        </div>
        {loading?<Loading/>:shown.length===0?<Empty text="No users found."/>:(
          <table>
            <thead><tr><th>Name</th><th>Handle</th><th>Phone</th><th>Location</th><th>Risk</th><th>Verified</th><th>Badge</th><th>Credits</th><th></th><th></th></tr></thead>
            <tbody>
              {shown.map(u=>(
                <tr key={u.id} style={u.banned?{opacity:.55}:undefined}>
                  <td><b>{u.full_name||'—'}</b>{u.banned&&<span className="badge b-danger" style={{marginLeft:6}}>Banned</span>}</td>
                  <td className="muted">{u.handle?'@'+u.handle:'—'}</td>
                  <td className="muted">{u.phone||'—'}</td>
                  <td className="muted">{loc(u)}</td>
                  <td><RiskChip n={u.risk||0}/></td>
                  <td>{u.aadhaar_verified?<span className="badge b-ok"><ShieldCheck size={12}/> KYC</span>:<span className="badge b-mut">—</span>}</td>
                  <td>
                    <select value={u.badge||''} onChange={e=>setBadge(u.id,e.target.value)}>
                      {BADGES.map(b=><option key={b.v} value={b.v}>{b.label}</option>)}
                    </select>
                  </td>
                  <td>{(u.bonus_feature_credits||0)>0?<span className="badge b-ok" title="Bonus feature credits">{u.bonus_feature_credits}</span>:<span className="badge b-mut">—</span>}</td>
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
