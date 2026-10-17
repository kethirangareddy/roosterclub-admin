import { useState } from 'react';
import { supabase } from './supabase';
import { toast } from './feedback';
import { KeyRound } from 'lucide-react';

// Shown after the user opens the password-recovery email link. A temporary
// recovery session is already active, so we just set a new password.
export default function ResetPassword({ onDone, expired=false }:{ onDone:()=>void; expired?:boolean }){
  const [pw,setPw]=useState('');
  const [pw2,setPw2]=useState('');
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault(); setErr('');
    if(pw.length<8){ setErr('Use at least 8 characters.'); return; }
    if(pw!==pw2){ setErr('Passwords do not match.'); return; }
    setBusy(true);
    const { error }=await supabase.auth.updateUser({ password:pw });
    setBusy(false);
    if(error){ setErr(error.message); return; }
    onDone(); // recovery session is valid → App drops into the dashboard
  }

  // Leave without changing the password (expired link, or changed your mind).
  async function backToSignIn(){
    const { error }=await supabase.auth.signOut();
    if(error){ toast("Couldn't sign out — you seem to be offline. Try again."); return; }
    onDone();
  }

  if(expired) return (
    <div className="login">
      <div className="box">
        <div className="logo"><KeyRound size={24} style={{verticalAlign:'-4px'}}/> Link expired</div>
        <p>This reset link has expired or was already used. Go back and use "Forgot password" again to get a new one.</p>
        <button className="btn" onClick={backToSignIn}>Back to sign in</button>
      </div>
    </div>
  );

  return (
    <div className="login">
      <div className="box">
        <div className="logo"><KeyRound size={24} style={{verticalAlign:'-4px'}}/> Set a new password</div>
        <p>Choose a new password for your admin account.</p>
        <form onSubmit={submit}>
          {err && <div className="err">{err}</div>}
          <div><label>New password</label>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
              required style={{width:'100%'}} autoComplete="new-password"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}/></div>
          <div><label>Confirm password</label>
            <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)}
              required style={{width:'100%'}} autoComplete="new-password"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}/></div>
          <button className="btn" disabled={busy}>{busy?'Saving…':'Save password'}</button>
        </form>
        <button className="btn ghost sm" style={{marginTop:10}} onClick={backToSignIn}>Back to sign in</button>
      </div>
    </div>
  );
}
