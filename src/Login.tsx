import { useState } from 'react';
import { supabase } from './supabase';
import { Egg } from 'lucide-react';

export default function Login(){
  const [mode,setMode]=useState<'login'|'forgot'>('login');
  const [email,setEmail]=useState('');
  const [pw,setPw]=useState('');
  const [err,setErr]=useState('');
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    const { error }=await supabase.auth.signInWithPassword({ email:email.trim().toLowerCase(), password:pw });
    setBusy(false);
    if(error) setErr(error.message);
  }

  async function sendReset(e:React.FormEvent){
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    const { error }=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if(error){ setErr(error.message); return; }
    setMsg('If that email has an account, a reset link is on its way. Open it on this device to set a new password.');
  }

  const emailInput=(
    <div><label>Email</label>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
        placeholder="you@roosterclub.in" required style={{width:'100%'}}
        inputMode="email" autoComplete="username" autoCapitalize="none"
        autoCorrect="off" spellCheck={false}/></div>
  );

  return (
    <div className="login">
      <div className="box">
        <div className="logo"><Egg size={26} style={{verticalAlign:'-4px'}}/> Rooster Club</div>
        <p>Admin Dashboard</p>

        {mode==='login' ? (
          <form onSubmit={submit}>
            {err && <div className="err">{err}</div>}
            {emailInput}
            <div><label>Password</label>
              <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
                required style={{width:'100%'}}
                autoComplete="current-password" autoCapitalize="none"
                autoCorrect="off" spellCheck={false}/></div>
            <button className="btn" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
            <button type="button" onClick={()=>{setMode('forgot');setErr('');setMsg('');}}
              style={{marginTop:12,background:'none',border:'none',color:'#BA7517',cursor:'pointer',padding:0,font:'inherit'}}>
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={sendReset}>
            {err && <div className="err">{err}</div>}
            {msg && <div className="err" style={{background:'#EAF7EA',color:'#256B2E'}}>{msg}</div>}
            {emailInput}
            <button className="btn" disabled={busy}>{busy?'Sending…':'Send reset link'}</button>
            <button type="button" onClick={()=>{setMode('login');setErr('');setMsg('');}}
              style={{marginTop:12,background:'none',border:'none',color:'#BA7517',cursor:'pointer',padding:0,font:'inherit'}}>
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
