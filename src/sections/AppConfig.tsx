import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { ToggleLeft, Wrench, Smartphone, Save, IndianRupee } from 'lucide-react';
import { Field, Loading } from '../ui';

const LANGS: [string,string][] = [['en','English'],['te','తెలుగు'],['hi','हिंदी'],['kn','ಕನ್ನಡ'],['ta','தமிழ்'],['ml','മലയാളം']];
const FEATURES: [string,string][] = [
  ['auction','Auctions'],['forum','Forum'],['alerts','Alerts (disease/theft)'],
  ['shop','Shop'],['vet','Doctors'],['livefeed','Live Feed'],
];

/** Remote config — flip app behavior live, no EAS rebuild. The app reads app_config at launch. */
export default function AppConfig(){
  const [cfg,setCfg]=useState<Record<string,any>|null>(null);
  const [dirty,setDirty]=useState<Set<string>>(new Set());
  const [saving,setSaving]=useState(false);

  async function load(){
    const { data, error }=await supabase.from('app_config').select('key,value');
    if(error){ alert('Could not load config: '+error.message); return; }
    const map:Record<string,any>={};
    (data||[]).forEach(r=>{ map[r.key]=r.value; });
    setCfg(map); setDirty(new Set());
  }
  useEffect(()=>{ load(); },[]);

  function patch(key:string, updater:(v:any)=>any){
    setCfg(c=>({ ...c!, [key]:updater(c![key]??{}) }));
    setDirty(d=>new Set(d).add(key));
  }
  async function save(){
    if(!cfg) return;
    setSaving(true);
    for(const key of dirty){
      const { error }=await supabase.from('app_config')
        .upsert({ key, value:cfg[key], updated_at:new Date().toISOString() });
      if(error){ setSaving(false); alert(`Could not save "${key}": `+error.message); return; }
    }
    setSaving(false); setDirty(new Set());
    alert('Saved. Users pick this up next time the app launches.');
  }

  if(!cfg) return <><h1 className="h1">App Config</h1><Loading/></>;
  const feats=cfg.features??{}; const maint=cfg.maintenance??{active:false,message:{}}; const ver=cfg.version??{};
  const prices=cfg.prices??{feature_day:99,boost_levels:{},feature_by_state:{}};
  const BOOSTS:[string,string][]=[['mandal','Mandal'],['district','District'],['states','Four States'],['india','India-wide']];
  const STATES=['Andhra Pradesh','Telangana','Tamil Nadu','Karnataka'];

  return (
    <>
      <h1 className="h1">App Config</h1>
      <p className="sub">Control the live app without a rebuild — users pick changes up on next launch. Turning a feature off hides its Home tile.</p>

      <div className="card">
        <div className="card-h"><h2><ToggleLeft size={16}/> Feature switches</h2></div>
        <div style={{padding:16,display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:10}}>
          {FEATURES.map(([k,label])=>{
            const on=feats[k]!==false;
            return (
              <label key={k} style={{display:'flex',alignItems:'center',gap:10,background:'var(--glass)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',cursor:'pointer'}}>
                <input type="checkbox" checked={on} onChange={e=>patch('features',v=>({ ...v,[k]:e.target.checked }))}/>
                <span style={{fontSize:13.5,fontWeight:600}}>{label}</span>
                <span className={'badge '+(on?'b-ok':'b-danger')} style={{marginLeft:'auto'}}>{on?'ON':'OFF'}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2><Wrench size={16}/> Maintenance banner</h2></div>
        <div style={{padding:16,display:'grid',gap:12}}>
          <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
            <input type="checkbox" checked={!!maint.active} onChange={e=>patch('maintenance',v=>({ ...v,active:e.target.checked }))}/>
            <span style={{fontSize:13.5,fontWeight:600}}>Show a banner at the top of Home</span>
            {maint.active && <span className="badge b-warn">visible to all users</span>}
          </label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {LANGS.map(([code,name])=>(
              <Field key={code} label={name}>
                <input style={{width:'100%'}} value={maint.message?.[code]??''} maxLength={140}
                  placeholder={code==='en'?'e.g. Auctions paused tonight 9–10 PM for maintenance.':''}
                  onChange={e=>patch('maintenance',v=>({ ...v, message:{ ...(v.message??{}), [code]:e.target.value } }))}/>
              </Field>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2><Smartphone size={16}/> Minimum version</h2></div>
        <div style={{padding:16,display:'grid',gap:12}}>
          <div className="grid2">
            <Field label="Minimum supported version (current app is 1.0.0)">
              <input style={{width:'100%'}} value={ver.min_version??''} placeholder="1.0.0"
                onChange={e=>patch('version',v=>({ ...v, min_version:e.target.value.trim() }))}/>
            </Field>
            <Field label="Upgrade message (English — shown as an alert)">
              <input style={{width:'100%'}} value={ver.message??''} maxLength={140}
                onChange={e=>patch('version',v=>({ ...v, message:e.target.value }))}/>
            </Field>
          </div>
          <div className="muted" style={{fontSize:12}}>Users on an older version see the upgrade alert on launch. Leave at 1.0.0 until you actually ship a must-have update.</div>
        </div>
      </div>

      {/* Item 19 — price experiments: change prices live (even per state) without a rebuild */}
      <div className="card">
        <div className="card-h"><h2><IndianRupee size={16}/> Prices (live — no rebuild)</h2></div>
        <div style={{padding:16,display:'grid',gap:14}}>
          <div className="grid2">
            <Field label="Profile feature — ₹ per day (default)">
              <input type="number" style={{width:'100%'}} value={prices.feature_day??99}
                onChange={e=>patch('prices',v=>({ ...v, feature_day:Number(e.target.value)||0 }))}/>
            </Field>
            <div/>
          </div>
          <div>
            <label>Boost level prices (₹)</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginTop:6}}>
              {BOOSTS.map(([k,label])=>(
                <Field key={k} label={label}>
                  <input type="number" style={{width:'100%'}} value={prices.boost_levels?.[k]??''}
                    onChange={e=>patch('prices',v=>({ ...v, boost_levels:{ ...(v.boost_levels??{}), [k]:Number(e.target.value)||0 } }))}/>
                </Field>
              ))}
            </div>
          </div>
          <div>
            <label>Feature price per state — leave blank to use the default (A/B a state without touching the rest)</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10,marginTop:6}}>
              {STATES.map(s=>(
                <Field key={s} label={s}>
                  <input type="number" style={{width:'100%'}} placeholder={String(prices.feature_day??99)}
                    value={prices.feature_by_state?.[s]??''}
                    onChange={e=>patch('prices',v=>{
                      const m={ ...(v.feature_by_state??{}) };
                      if(e.target.value==='') delete m[s]; else m[s]=Number(e.target.value)||0;
                      return { ...v, feature_by_state:m };
                    })}/>
                </Field>
              ))}
            </div>
          </div>
          <div className="muted" style={{fontSize:12}}>The app reads these at launch for the “Feature your profile” price. Boost prices pre-fill the admin “Log payment” form.</div>
        </div>
      </div>

      <div style={{position:'sticky',bottom:14,display:'flex',justifyContent:'flex-end'}}>
        <button className="btn" disabled={saving||dirty.size===0} onClick={save}>
          <Save size={15}/> {saving?'Saving…':dirty.size?`Save ${dirty.size} change${dirty.size>1?'s':''}`:'Saved'}
        </button>
      </div>
    </>
  );
}
