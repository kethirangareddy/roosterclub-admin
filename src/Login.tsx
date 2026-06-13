import { useState } from 'react';
import { supabase } from './supabase';
import { Egg } from 'lucide-react';

export default function Login(){
  const [email,setEmail]=useState('');
  const [pw,setPw]=useState('');
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault(); setErr(''); setBusy(true);
    const { error }=await supabase.auth.signInWithPassword({ email:email.trim(), password:pw });
    setBusy(false);
    if(error) setErr(error.message);
  }

  return (
    <div className="login">
      <div className="box">
        <div className="logo"><Egg size={26} style={{verticalAlign:'-4px'}}/> Rooster Club</div>
        <p>Admin Dashboard</p>
        <form onSubmit={submit}>
          {err && <div className="err">{err}</div>}
          <div><label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="you@roosterclub.in" required style={{width:'100%'}}/></div>
          <div><label>Password</label>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
              required style={{width:'100%'}}/></div>
          <button className="btn" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
