import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { ToggleLeft, Wrench, Smartphone, Save, IndianRupee, Image as ImageIcon, Link2 } from 'lucide-react';
import { Field, Loading } from '../ui';

const LANGS: [string,string][] = [['en','English'],['te','తెలుగు'],['hi','हिंदी'],['kn','ಕನ್ನಡ'],['ta','தமிழ்'],['ml','മലയാളം']];
const FEATURES: [string,string][] = [
  ['auction','Auctions'],['forum','Forum'],['alerts','Alerts (disease/theft)'],
  ['shop','Shop'],['vet','Doctors'],['livefeed','Live Feed'],
];

/** Same rules the app applies in lib/appConfig.ts getPartnerLink — if this says
    "problem", the app would silently hide the card, so catch it here instead. */
function partnerProblem(p:any): string|null {
  const pkg=(p.package??'').trim();
  if(!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(pkg)) return 'Package name looks wrong (e.g. kodi.sastram — copy it from the Play Store link after id=).';
  if(!((p.title?.en??'').trim()||(p.title?.te??'').trim())) return 'Give it a title (at least English or Telugu).';
  const s=(p.scheme??'').trim();
  if(s && (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^(https?|intent|market|file|content|javascript|data):/i.test(s)))
    return 'Deep link must look like theirapp:// (no http, intent or market links). Leave blank if they haven\'t given one.';
  const img=(p.image_url??'').trim();
  if(img && !/^https:\/\//i.test(img)) return 'Logo must be an https:// link (or use Upload).';
  return null;
}

/** Remote config — flip app behavior live, no EAS rebuild. The app reads app_config at launch. */
export default function AppConfig(){
  const [cfg,setCfg]=useState<Record<string,any>|null>(null);
  const [dirty,setDirty]=useState<Set<string>>(new Set());
  const [saving,setSaving]=useState(false);
  const [bannerUploading,setBannerUploading]=useState(false);
  const [partnerUploading,setPartnerUploading]=useState(false);
  const [partnerStats,setPartnerStats]=useState<any[]|null>(null);

  async function loadPartnerStats(){
    const { data, error }=await supabase.rpc('admin_partner_clicks');
    setPartnerStats(error?[]:(data||[]));
  }
  useEffect(()=>{ loadPartnerStats(); },[]);

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
    const bl=(cfg.banner?.link??'').trim();
    if(dirty.has('banner') && bl && !/^https:\/\//i.test(bl)){ alert('Home banner link must start with https://'); return; }
    if(dirty.has('partner')){
      const p=cfg.partner??{};
      const err=partnerProblem(p);
      if(err && p.active){ alert('Partner app: '+err); return; }
    }
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
  const banner=cfg.banner??{active:true,title:{},sub:{},cta:{},link:'',image_url:''};
  const partner=cfg.partner??{active:false,id:'',package:'',scheme:'',image_url:'',title:{},sub:{},cta:{}};
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

      {/* Home banner (app_config.banner). Point it at your product: picture, words per
          language and a link (WhatsApp, a web page). Blank fields fall back to the
          built-in "Message the team" copy. Users get it on next app launch. */}
      <div className="card">
        <div className="card-h"><h2><ImageIcon size={16}/> Home banner</h2></div>
        <div style={{padding:16,display:'grid',gap:12}}>
          <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
            <input type="checkbox" checked={banner.active!==false} onChange={e=>patch('banner',v=>({ ...v,active:e.target.checked }))}/>
            <span style={{fontSize:13.5,fontWeight:600}}>Show the banner on Home</span>
          </label>
          <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
            {banner.image_url ? <img src={banner.image_url} className="thumb" style={{width:56,height:56}}/> : <div className="thumb" style={{width:56,height:56}}/>}
            <label className="btn ghost sm" style={{cursor:'pointer'}}>
              {bannerUploading?'Uploading…':'Upload picture'}
              <input type="file" accept="image/*" hidden onClick={e=>{(e.target as HTMLInputElement).value='';}}
                onChange={async e=>{
                  const f=e.target.files?.[0]; if(!f) return;
                  setBannerUploading(true);
                  const path=`banner/${Date.now()}-${Math.random().toString(36).slice(2)}.${(f.name.split('.').pop()||'jpg').toLowerCase()}`;
                  const up=await supabase.storage.from('product-images').upload(path,f,{contentType:f.type});
                  setBannerUploading(false);
                  if(up.error){ alert('Upload failed: '+up.error.message); return; }
                  const url=supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
                  patch('banner',v=>({ ...v,image_url:url }));
                }}/>
            </label>
            {banner.image_url && <button className="btn ghost sm" onClick={()=>patch('banner',v=>({ ...v,image_url:'' }))}>Use the logo</button>}
          </div>
          <Field label="Link (https:// — e.g. https://wa.me/91XXXXXXXXXX?text=… or a web page). Blank = message the team on WhatsApp.">
            <input style={{width:'100%'}} value={banner.link??''} placeholder="https://wa.me/91…"
              onChange={e=>patch('banner',v=>({ ...v,link:e.target.value.trim() }))}/>
          </Field>
          {!!banner.link && !/^https:\/\//i.test(banner.link) && <div style={{color:'#b45309',fontSize:12.5}}>The link must start with https:// — the app won't open anything else.</div>}
          {(['title','sub','cta'] as const).map(part=>(
            <div key={part}>
              <div className="muted" style={{fontSize:12,fontWeight:600,margin:'4px 0'}}>{part==='title'?'Title':part==='sub'?'Second line':'Button text'}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                {LANGS.map(([code,name])=>(
                  <input key={code} placeholder={name} maxLength={part==='cta'?24:80} value={banner[part]?.[code]??''}
                    onChange={e=>patch('banner',v=>({ ...v,[part]:{ ...(v[part]??{}),[code]:e.target.value } }))}/>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Partner app (app_config.partner). A card on Home, under the banner, that
          opens another Play Store app (theirs if installed, else its Play Store page).
          Every tap is counted in partner_clicks. Needs app build with the partner card. */}
      <div className="card">
        <div className="card-h"><h2><Link2 size={16}/> Partner app</h2></div>
        <div style={{padding:16,display:'grid',gap:12}}>
          <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
            <input type="checkbox" checked={partner.active===true} onChange={e=>patch('partner',v=>({ ...v,active:e.target.checked }))}/>
            <span style={{fontSize:13.5,fontWeight:600}}>Show the partner card on Home</span>
            <span className={'badge '+(partner.active?'b-ok':'b-danger')} style={{marginLeft:'auto'}}>{partner.active?'ON':'OFF'}</span>
          </label>
          {partner.active && partnerProblem(partner) && <div style={{color:'#b45309',fontSize:12.5}}>{partnerProblem(partner)}</div>}
          <div className="grid2">
            <Field label="Play Store package (the part after id= in their link)">
              <input style={{width:'100%'}} value={partner.package??''} placeholder="kodi.sastram"
                onChange={e=>patch('partner',v=>({ ...v,package:e.target.value.trim() }))}/>
            </Field>
            <Field label="Tracking name (shows in the tap counts below)">
              <input style={{width:'100%'}} value={partner.id??''} placeholder="kodi_sastram" maxLength={100}
                onChange={e=>patch('partner',v=>({ ...v,id:e.target.value.trim() }))}/>
            </Field>
          </div>
          <Field label="Their deep link — optional, only if their developer gives you one (e.g. kodisastram://). Opens their app directly.">
            <input style={{width:'100%'}} value={partner.scheme??''} placeholder="leave blank"
              onChange={e=>patch('partner',v=>({ ...v,scheme:e.target.value.trim() }))}/>
          </Field>
          <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
            {partner.image_url ? <img src={partner.image_url} className="thumb" style={{width:48,height:48}}/> : <div className="thumb" style={{width:48,height:48}}/>}
            <label className="btn ghost sm" style={{cursor:'pointer'}}>
              {partnerUploading?'Uploading…':'Upload their logo'}
              <input type="file" accept="image/*" hidden onClick={e=>{(e.target as HTMLInputElement).value='';}}
                onChange={async e=>{
                  const f=e.target.files?.[0]; if(!f) return;
                  setPartnerUploading(true);
                  const path=`partner/${Date.now()}-${Math.random().toString(36).slice(2)}.${(f.name.split('.').pop()||'png').toLowerCase()}`;
                  const up=await supabase.storage.from('product-images').upload(path,f,{contentType:f.type});
                  setPartnerUploading(false);
                  if(up.error){ alert('Upload failed: '+up.error.message); return; }
                  const url=supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
                  patch('partner',v=>({ ...v,image_url:url }));
                }}/>
            </label>
            {partner.image_url && <button className="btn ghost sm" onClick={()=>patch('partner',v=>({ ...v,image_url:'' }))}>No logo</button>}
          </div>
          {(['title','sub','cta'] as const).map(part=>(
            <div key={part}>
              <div className="muted" style={{fontSize:12,fontWeight:600,margin:'4px 0'}}>{part==='title'?'App name':part==='sub'?'Second line':'Button text'}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                {LANGS.map(([code,name])=>(
                  <input key={code} placeholder={name} maxLength={part==='cta'?24:80} value={partner[part]?.[code]??''}
                    onChange={e=>patch('partner',v=>({ ...v,[part]:{ ...(v[part]??{}),[code]:e.target.value } }))}/>
                ))}
              </div>
            </div>
          ))}
          <div className="muted" style={{fontSize:12}}>Keep the wording about varieties / guides — never betting or "winning" predictions (Play Store gambling policy).</div>

          <div style={{borderTop:'1px solid var(--line)',paddingTop:12}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{fontSize:13.5,fontWeight:700}}>Taps from Rooster Club</span>
              <button className="btn ghost sm" style={{marginLeft:'auto'}} onClick={loadPartnerStats}>Refresh</button>
            </div>
            {partnerStats===null ? <Loading/> : partnerStats.length===0 ? (
              <div className="muted" style={{fontSize:12.5}}>No taps yet.</div>
            ) : (
              <table className="tbl" style={{width:'100%'}}>
                <thead><tr><th>Partner</th><th>Total taps</th><th>Unique users</th><th>Last 7 days</th><th>Last tap</th></tr></thead>
                <tbody>
                  {partnerStats.map((r:any)=>(
                    <tr key={r.partner}>
                      <td>{r.partner}</td><td>{r.taps}</td><td>{r.unique_users}</td><td>{r.taps_7d}</td>
                      <td>{r.last_tap?new Date(r.last_tap).toLocaleString('en-IN'):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="muted" style={{fontSize:12,marginTop:6}}>Compare "Unique users" with the installs he reports (tagged utm_source=roosterclub in his Play Console). Usually 30–60% of tappers install.</div>
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
