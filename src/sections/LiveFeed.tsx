import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Truck, Check, Plus } from 'lucide-react';
import { Modal, Field, Empty, Loading, loc, inr, timeAgo } from '../ui';
import { STATES, districtsFor } from '../locations';

const AVAIL = [['daily','Daily'],['pre_order','Pre-order'],['bulk','Bulk']] as const;
const BLANK = { name:'', feed_type:'BSF larvae', price_per_kg:0, availability:'daily',
  phone:'', state:'', district:'', mandal:'', approved:true };

export default function LiveFeed({ onChange }:{ onChange:()=>void }){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<'pending'|'approved'>('pending');
  const [edit,setEdit]=useState<any|null>(null);
  const [meId,setMeId]=useState<string|null>(null);

  useEffect(()=>{ supabase.auth.getUser().then(({data})=>setMeId(data.user?.id??null)); },[]);

  async function load(){
    setLoading(true);
    const { data }=await supabase.from('live_feed_sellers').select('*')
      .eq('approved',tab==='approved').order('created_at',{ascending:false});
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[tab]);

  async function approve(id:string){
    await supabase.from('live_feed_sellers').update({ approved:true }).eq('id',id);
    setRows(r=>r.filter(x=>x.id!==id)); onChange();
  }
  async function remove(id:string){
    if(!confirm('Remove this live-feed seller?')) return;
    await supabase.from('live_feed_sellers').delete().eq('id',id);
    setRows(r=>r.filter(x=>x.id!==id)); onChange();
  }
  async function save(){
    const v={...edit};
    if(!String(v.name||'').trim()){ alert('Name is required.'); return; }
    if(!String(v.phone||'').trim()){ alert('Phone is required.'); return; }
    v.price_per_kg=Number(v.price_per_kg)||0;
    const id=v.id; delete v.id; delete v.created_at;
    if(!id) v.user_id=meId;
    const { error }= id ? await supabase.from('live_feed_sellers').update(v).eq('id',id)
                        : await supabase.from('live_feed_sellers').insert(v);
    if(error){ alert(error.message); return; }
    setEdit(null);
    setTab('approved'); // admin-added sellers are approved → show them
    load(); onChange();
  }

  return (
    <>
      <h1 className="h1">Live Feed</h1>
      <p className="sub">BSF larvae / live-insect feed sellers. Add sellers yourself, or approve the ones who request from the app.</p>
      <div className="tabbar">
        <button className={tab==='pending'?'active':''} onClick={()=>setTab('pending')}>Pending requests</button>
        <button className={tab==='approved'?'active':''} onClick={()=>setTab('approved')}>Approved</button>
      </div>
      <div className="card">
        <div className="card-h">
          <h2><Truck size={16}/> {tab==='pending'?'Requests':'Approved sellers'} ({rows.length})</h2>
          <button className="btn" onClick={()=>setEdit({...BLANK})}><Plus size={15}/> Add seller</button>
        </div>
        {loading?<Loading/>:rows.length===0?<Empty text={tab==='pending'?'No pending requests.':'No approved sellers yet.'}/>:(
          <table>
            <thead><tr><th>Name</th><th>Feed type</th><th>Price/kg</th><th>Availability</th><th>Phone</th><th>Location</th><th>Added</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.name}</b></td>
                  <td>{r.feed_type||'—'}</td>
                  <td>{inr(r.price_per_kg)}</td>
                  <td className="muted">{r.availability||'—'}</td>
                  <td className="muted">{r.phone||'—'}</td>
                  <td className="muted">{loc(r)}</td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><div className="row-acts">
                    {tab==='pending' && <button className="btn ok sm" onClick={()=>approve(r.id)}><Check size={13}/> Approve</button>}
                    <button className="btn ghost sm" onClick={()=>setEdit({...r})}>Edit</button>
                    <button className="btn danger sm" onClick={()=>remove(r.id)}>Remove</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <Modal title={edit.id?'Edit seller':'Add live-feed seller'} onClose={()=>setEdit(null)}
          footer={<><button className="btn ghost" onClick={()=>setEdit(null)}>Cancel</button>
                    <button className="btn" onClick={save}>Save</button></>}>
          <Field label="Unit / seller name"><input style={{width:'100%'}} value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})} placeholder="e.g. Sri Larvae Farms"/></Field>
          <div className="grid2">
            <Field label="Feed type"><input style={{width:'100%'}} value={edit.feed_type||''} onChange={e=>setEdit({...edit,feed_type:e.target.value})} placeholder="BSF larvae / Worms"/></Field>
            <Field label="Price per kg (₹)"><input type="number" style={{width:'100%'}} value={edit.price_per_kg} onChange={e=>setEdit({...edit,price_per_kg:e.target.value})}/></Field>
          </div>
          <div className="grid2">
            <Field label="Availability">
              <select style={{width:'100%'}} value={edit.availability} onChange={e=>setEdit({...edit,availability:e.target.value})}>
                {AVAIL.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Phone"><input style={{width:'100%'}} value={edit.phone||''} onChange={e=>setEdit({...edit,phone:e.target.value})}/></Field>
          </div>
          <div className="grid2">
            <Field label="State">
              <select style={{width:'100%'}} value={edit.state||''} onChange={e=>setEdit({...edit,state:e.target.value,district:''})}>
                <option value="">Select state</option>
                {STATES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="District">
              <select style={{width:'100%'}} value={edit.district||''} onChange={e=>setEdit({...edit,district:e.target.value})} disabled={!edit.state}>
                <option value="">{edit.state?'Select district':'Pick a state first'}</option>
                {districtsFor(edit.state||'').map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Mandal"><input style={{width:'100%'}} value={edit.mandal||''} onChange={e=>setEdit({...edit,mandal:e.target.value})}/></Field>
        </Modal>
      )}
    </>
  );
}
