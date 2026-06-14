import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { BookOpen, Plus } from 'lucide-react';
import { Modal, Field, Empty, Loading, timeAgo } from '../ui';

const CATS=['Breed Guide','Ancient Omens','Training','Care & Health','Bloodlines','General'];
const BLANK={ title:'',body:'',category:'General',cover_url:'',published:false };

export default function Kukuta(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [edit,setEdit]=useState<any|null>(null);

  async function load(){
    setLoading(true);
    const { data }=await supabase.from('kukuta_articles').select('*').order('created_at',{ascending:false});
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function save(){
    const v={...edit}; const id=v.id; delete v.id; delete v.created_at;
    if(!v.title?.trim()||!v.body?.trim()){ alert('Title and body are both required.'); return; }
    const { error }= id ? await supabase.from('kukuta_articles').update(v).eq('id',id)
                        : await supabase.from('kukuta_articles').insert(v);
    if(error){ alert(error.message); return; }
    setEdit(null); load();
  }
  async function togglePub(r:any){
    const { error }=await supabase.from('kukuta_articles').update({published:!r.published}).eq('id',r.id); if(error){ alert('Could not update: '+error.message); return; } load();
  }
  async function remove(id:string){
    if(!confirm('Delete this article?')) return;
    const { error }=await supabase.from('kukuta_articles').delete().eq('id',id); if(error){ alert('Could not delete: '+error.message); return; } load();
  }

  return (
    <>
      <h1 className="h1">Kukuta Shastram</h1>
      <p className="sub">Cultural article library. Publish to make visible in the app.</p>
      <div className="card">
        <div className="card-h">
          <h2><BookOpen size={16}/> Articles ({rows.length})</h2>
          <button className="btn" onClick={()=>setEdit({...BLANK})}><Plus size={15}/> Write article</button>
        </div>
        {loading?<Loading/>:rows.length===0?<Empty text="No articles yet. Write your first one."/>:(
          <table>
            <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.title}</b></td>
                  <td><span className="badge b-mut">{r.category||'General'}</span></td>
                  <td><span className={'badge '+(r.published?'b-ok':'b-warn')}>{r.published?'Published':'Draft'}</span></td>
                  <td className="muted">{timeAgo(r.created_at)}</td>
                  <td><div className="row-acts">
                    <button className="btn ghost sm" onClick={()=>togglePub(r)}>{r.published?'Unpublish':'Publish'}</button>
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
        <Modal title={edit.id?'Edit article':'Write article'} onClose={()=>setEdit(null)}
          footer={<><button className="btn ghost" onClick={()=>setEdit(null)}>Cancel</button>
                    <button className="btn" onClick={save}>Save</button></>}>
          <Field label="Title"><input style={{width:'100%'}} value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/></Field>
          <Field label="Category"><select style={{width:'100%'}} value={edit.category||'General'} onChange={e=>setEdit({...edit,category:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select></Field>
          <Field label="Cover image URL (optional)"><input style={{width:'100%'}} value={edit.cover_url||''} onChange={e=>setEdit({...edit,cover_url:e.target.value})} placeholder="https://…"/></Field>
          <Field label="Body"><textarea rows={10} style={{width:'100%',resize:'vertical'}} value={edit.body||''} onChange={e=>setEdit({...edit,body:e.target.value})}/></Field>
          <Field label="Publish now?"><select style={{width:'100%'}} value={edit.published?'1':'0'} onChange={e=>setEdit({...edit,published:e.target.value==='1'})}><option value="0">Save as draft</option><option value="1">Publish</option></select></Field>
        </Modal>
      )}
    </>
  );
}
