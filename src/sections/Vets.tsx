import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Stethoscope, Plus, Star } from 'lucide-react';
import { Modal, Field, Empty, Loading, loc, inr } from '../ui';

const BLANK={ name:'',speciality:'',years_experience:0,consultation_charge:0,phone:'',
  state:'',district:'',mandal:'',is_open:true,is_featured:false,featured_position:null as number|null };

export default function Vets(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [edit,setEdit]=useState<any|null>(null);

  async function load(){
    setLoading(true);
    const { data }=await supabase.from('vets').select('*')
      .order('is_featured',{ascending:false}).order('featured_position',{ascending:true,nullsFirst:false})
      .order('created_at',{ascending:false});
    setRows(data||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function save(){
    const v={...edit};
    for(const f of ['name','phone','state','district','mandal'] as const){
      if(!String(v[f]||'').trim()){ alert('Required: name, phone, state, district and mandal.'); return; }
    }
    const id=v.id; delete v.id; delete v.created_at;
    v.years_experience=Number(v.years_experience)||0;
    v.consultation_charge=Number(v.consultation_charge)||0;
    v.featured_position=v.is_featured?(Number(v.featured_position)||1):null;
    const { error }= id ? await supabase.from('vets').update(v).eq('id',id)
                        : await supabase.from('vets').insert(v);
    if(error){ alert(error.message); return; }
    setEdit(null); load();
  }
  async function remove(id:string){
    if(!confirm('Remove this vet?')) return;
    await supabase.from('vets').delete().eq('id',id); load();
  }

  return (
    <>
      <h1 className="h1">Veterinary</h1>
      <p className="sub">Admin-listed poultry vets. Top 3 featured slots appear first in the app.</p>
      <div className="card">
        <div className="card-h">
          <h2><Stethoscope size={16}/> Vets ({rows.length})</h2>
          <button className="btn" onClick={()=>setEdit({...BLANK})}><Plus size={15}/> Add vet</button>
        </div>
        {loading?<Loading/>:rows.length===0?<Empty text="No vets yet. Add your first one."/>:(
          <table>
            <thead><tr><th>Name</th><th>Speciality</th><th>Exp.</th><th>Charge</th><th>Phone</th><th>Location</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.name}</b>{r.is_featured && <Star size={13} fill="#BA7517" color="#BA7517" style={{marginLeft:6,verticalAlign:'-1px'}}/>}</td>
                  <td>{r.speciality||'—'}</td>
                  <td>{r.years_experience}y</td>
                  <td>{inr(r.consultation_charge)}</td>
                  <td className="muted">{r.phone||'—'}</td>
                  <td className="muted">{loc(r)}</td>
                  <td><span className={'badge '+(r.is_open?'b-ok':'b-mut')}>{r.is_open?'Open':'Closed'}</span></td>
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
        <Modal title={edit.id?'Edit vet':'Add vet'} onClose={()=>setEdit(null)}
          footer={<><button className="btn ghost" onClick={()=>setEdit(null)}>Cancel</button>
                    <button className="btn" onClick={save}>Save</button></>}>
          <Field label="Name"><input style={{width:'100%'}} value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/></Field>
          <Field label="Speciality"><input style={{width:'100%'}} value={edit.speciality||''} onChange={e=>setEdit({...edit,speciality:e.target.value})} placeholder="e.g. Poultry surgery"/></Field>
          <div className="grid2">
            <Field label="Years experience"><input type="number" style={{width:'100%'}} value={edit.years_experience} onChange={e=>setEdit({...edit,years_experience:e.target.value})}/></Field>
            <Field label="Consultation charge (₹)"><input type="number" style={{width:'100%'}} value={edit.consultation_charge} onChange={e=>setEdit({...edit,consultation_charge:e.target.value})}/></Field>
          </div>
          <Field label="Phone"><input style={{width:'100%'}} value={edit.phone||''} onChange={e=>setEdit({...edit,phone:e.target.value})}/></Field>
          <div className="grid2">
            <Field label="State"><input style={{width:'100%'}} value={edit.state||''} onChange={e=>setEdit({...edit,state:e.target.value})}/></Field>
            <Field label="District"><input style={{width:'100%'}} value={edit.district||''} onChange={e=>setEdit({...edit,district:e.target.value})}/></Field>
          </div>
          <Field label="Mandal"><input style={{width:'100%'}} value={edit.mandal||''} onChange={e=>setEdit({...edit,mandal:e.target.value})}/></Field>
          <div className="grid2">
            <Field label="Open now?"><select style={{width:'100%'}} value={edit.is_open?'1':'0'} onChange={e=>setEdit({...edit,is_open:e.target.value==='1'})}><option value="1">Open</option><option value="0">Closed</option></select></Field>
            <Field label="Featured?"><select style={{width:'100%'}} value={edit.is_featured?'1':'0'} onChange={e=>setEdit({...edit,is_featured:e.target.value==='1'})}><option value="0">No</option><option value="1">Yes (top slot)</option></select></Field>
          </div>
          {edit.is_featured && <Field label="Featured position (1-3)"><input type="number" min={1} max={3} style={{width:'100%'}} value={edit.featured_position||1} onChange={e=>setEdit({...edit,featured_position:e.target.value})}/></Field>}
        </Modal>
      )}
    </>
  );
}
