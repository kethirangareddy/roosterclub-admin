import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Siren, Plus, Send } from 'lucide-react';
import { Modal, Field, Empty, Loading, loc, timeAgo } from '../ui';

const SEV=['low','medium','high'];
const BLANK={ title:'',description:'',severity:'medium',state:'',district:'',mandal:'',verified:false };

export default function Disease({ onChange }:{ onChange:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [edit,setEdit]=useState<any|null>(null);

  async function load(){
    setLoading(true);
    const { data, error }=await supabase.from('disease_alerts').select('*').order('created_at',{ascending:false});
    if(error) alert('Could not load alerts: '+error.message);
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function save(){
    const v={...edit}; const id=v.id; delete v.id; delete v.created_at; delete v.reported_by; delete v.pushed_at;
    if(!v.title?.trim()){ alert('Title required'); return; }
    // Blank region must be NULL, not '' — the app's Alerts list matches state to the
    // user's state OR NULL (all-India); an empty string matches neither and hides the alert.
    for(const f of ['state','district','mandal'] as const){ v[f]=(v[f]||'').trim()||null; }
    const { error }= id ? await supabase.from('disease_alerts').update(v).eq('id',id)
                        : await supabase.from('disease_alerts').insert(v);
    if(error){ alert(error.message); return; }
    setEdit(null); load(); onChange();
  }
  async function verifyPush(r:any){
    // Verify AND actually push the alert to the region via the edge function.
    // (Previously this only flipped verified/pushed_at and never sent a notification.)
    const { data, error }=await supabase.functions.invoke('notify-disease-verified',{ body:{ alert_id:r.id } });
    if(error){ alert('Could not verify & push: '+error.message); return; }
    if(data?.error){ alert('Could not verify & push: '+data.error); return; }
    load(); onChange();
  }
  async function remove(id:string){
    if(!confirm('Delete this alert?')) return;
    const { error }=await supabase.from('disease_alerts').delete().eq('id',id); if(error){ alert('Could not delete: '+error.message); return; } load(); onChange();
  }

  return (
    <>
      <h1 className="h1">Disease Alerts</h1>
      <p className="sub">Verify user reports, then push a regional alert to the app. Highest-priority notification.</p>
      <div className="card">
        <div className="card-h">
          <h2><Siren size={16}/> Alerts ({rows.length})</h2>
          <button className="btn" onClick={()=>setEdit({...BLANK})}><Plus size={15}/> New alert</button>
        </div>
        {loading?<Loading/>:rows.length===0?<Empty text="No reports yet."/>:(
          <table>
            <thead><tr><th>Title</th><th>Severity</th><th>Region</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.title}</b><div className="muted" style={{maxWidth:280,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.description||''}</div></td>
                  <td><span className={'badge '+(r.severity==='high'?'b-danger':r.severity==='medium'?'b-warn':'b-mut')}>{r.severity}</span></td>
                  <td className="muted">{loc(r)}</td>
                  <td>
                    {r.verified
                      ? <span className="badge b-ok">Live{r.pushed_at?'':' (not pushed)'}</span>
                      : <span className="badge b-warn">Unverified</span>}
                  </td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><div className="row-acts">
                    {!r.verified && <button className="btn ok sm" onClick={()=>verifyPush(r)}><Send size={13}/> Verify & push</button>}
                    <button className="btn ghost sm" onClick={()=>setEdit({...r})}>Edit</button>
                    <button className="btn danger sm" onClick={()=>remove(r.id)}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <Modal title={edit.id?'Edit alert':'New disease alert'} onClose={()=>setEdit(null)}
          footer={<><button className="btn ghost" onClick={()=>setEdit(null)}>Cancel</button>
                    <button className="btn" onClick={save}>Save</button></>}>
          <Field label="Title"><input style={{width:'100%'}} value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})} placeholder="e.g. Ranikhet outbreak reported"/></Field>
          <Field label="Description"><textarea rows={4} style={{width:'100%',resize:'vertical'}} value={edit.description||''} onChange={e=>setEdit({...edit,description:e.target.value})}/></Field>
          <Field label="Severity"><select style={{width:'100%'}} value={edit.severity} onChange={e=>setEdit({...edit,severity:e.target.value})}>{SEV.map(s=><option key={s}>{s}</option>)}</select></Field>
          <div className="grid2">
            <Field label="State"><input style={{width:'100%'}} value={edit.state||''} onChange={e=>setEdit({...edit,state:e.target.value})}/></Field>
            <Field label="District"><input style={{width:'100%'}} value={edit.district||''} onChange={e=>setEdit({...edit,district:e.target.value})}/></Field>
          </div>
          <Field label="Mandal (optional)"><input style={{width:'100%'}} value={edit.mandal||''} onChange={e=>setEdit({...edit,mandal:e.target.value})}/></Field>
          <div className="muted" style={{fontSize:12}}>Tip: leave region blank for a state-wide or all-India alert. Use “Verify &amp; push” on the row to make it live.</div>
        </Modal>
      )}
    </>
  );
}
