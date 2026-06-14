import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Bird, Plus } from 'lucide-react';
import { Modal, Field, Empty, Loading } from '../ui';

const BLANK={ name:'',bloodline:'',origin:'',traits:'',description:'',photo_url:'' };

export default function Breeds(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [edit,setEdit]=useState<any|null>(null);

  async function load(){
    setLoading(true);
    const { data }=await supabase.from('breed_encyclopedia').select('*').order('name',{ascending:true});
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function save(){
    const v={...edit}; const id=v.id; delete v.id; delete v.created_at;
    if(!v.name?.trim()){ alert('Name required'); return; }
    const { error }= id ? await supabase.from('breed_encyclopedia').update(v).eq('id',id)
                        : await supabase.from('breed_encyclopedia').insert(v);
    if(error){ alert(error.message); return; }
    setEdit(null); load();
  }
  async function remove(id:string){
    if(!confirm('Delete this breed entry?')) return;
    const { error }=await supabase.from('breed_encyclopedia').delete().eq('id',id); if(error){ alert('Could not delete: '+error.message); return; } load();
  }

  return (
    <>
      <h1 className="h1">Breed Encyclopedia</h1>
      <p className="sub">Reference guide of gamefowl breeds shown in the app.</p>
      <div className="card">
        <div className="card-h">
          <h2><Bird size={16}/> Breeds ({rows.length})</h2>
          <button className="btn" onClick={()=>setEdit({...BLANK})}><Plus size={15}/> Add breed</button>
        </div>
        {loading?<Loading/>:rows.length===0?<Empty text="No breeds yet. Add your first entry."/>:(
          <table>
            <thead><tr><th></th><th>Name</th><th>Bloodline</th><th>Origin</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td>{r.photo_url?<img className="thumb" src={r.photo_url}/>:<div className="thumb"/>}</td>
                  <td><b>{r.name}</b><div className="muted" style={{maxWidth:280,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.traits||''}</div></td>
                  <td>{r.bloodline||'—'}</td>
                  <td className="muted">{r.origin||'—'}</td>
                  <td><div className="row-acts">
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
        <Modal title={edit.id?'Edit breed':'Add breed'} onClose={()=>setEdit(null)}
          footer={<><button className="btn ghost" onClick={()=>setEdit(null)}>Cancel</button>
                    <button className="btn" onClick={save}>Save</button></>}>
          <Field label="Name"><input style={{width:'100%'}} value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/></Field>
          <div className="grid2">
            <Field label="Bloodline"><input style={{width:'100%'}} value={edit.bloodline||''} onChange={e=>setEdit({...edit,bloodline:e.target.value})}/></Field>
            <Field label="Origin"><input style={{width:'100%'}} value={edit.origin||''} onChange={e=>setEdit({...edit,origin:e.target.value})}/></Field>
          </div>
          <Field label="Traits (short)"><input style={{width:'100%'}} value={edit.traits||''} onChange={e=>setEdit({...edit,traits:e.target.value})} placeholder="e.g. Tall, aggressive, hardy"/></Field>
          <Field label="Photo URL"><input style={{width:'100%'}} value={edit.photo_url||''} onChange={e=>setEdit({...edit,photo_url:e.target.value})} placeholder="https://…"/></Field>
          <Field label="Description"><textarea rows={6} style={{width:'100%',resize:'vertical'}} value={edit.description||''} onChange={e=>setEdit({...edit,description:e.target.value})}/></Field>
        </Modal>
      )}
    </>
  );
}
