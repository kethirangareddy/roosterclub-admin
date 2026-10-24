import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { HardDrive, Trash2, RotateCcw, Clock, Film } from 'lucide-react';
import { Loading, timeAgo } from '../ui';
import { toast, ask } from '../feedback';

/** Storage (Cloudflare R2) — what's using space and the clean-up switches.
    Nothing here deletes a file straight away: files go to a 7-day trash first,
    and a daily job deletes them only if nothing in the app still uses them. */
const gb = (b?: number | null) => ((b ?? 0) / 1e9).toFixed(2) + ' GB';
const FOLDER: Record<string, string> = {
  'listing-media': 'Listing photos/videos', 'post-media': 'Reels & posts', 'chat-media': 'Chat files',
  avatars: 'Old profile photos', stories: 'Stories',
};

export default function Storage() {
  const [s, setS] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.rpc('admin_media_summary');
    if (error) { toast(error.message, 'danger'); setS({}); return; }
    setS(data);
  }
  useEffect(() => { load(); }, []);
  if (!s) return <Loading />;

  const p = s.retention_preview ?? {};
  const unused: any[] = s.unused ?? [];
  const unusedFiles = unused.reduce((a, u) => a + u.files, 0);
  const unusedBytes = unused.reduce((a, u) => a + u.bytes, 0);
  const days = s.retention_days ?? 20;

  async function setRetention(on: boolean) {
    const text = on
      ? `Turn ON the ${days}-day rule?\n\nPhotos and videos of listings not relisted for ${days} days (${p.listing_files ?? 0} files, ${gb(p.listing_bytes)}) and chat videos older than ${days} days (${p.chat_videos ?? 0}, ${gb(p.chat_bytes)}) go to the trash now, and every day after.\n\nListings, reviews and receipts stay. Files are deleted 7 days after they enter the trash — you can undo until then.`
      : `Turn OFF the ${days}-day rule? Nothing new will be trashed. Files already in the trash still get deleted on their date unless you press "Undo".`;
    if (!(await ask(text, { danger: on, okText: on ? 'Turn on' : 'Turn off' }))) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_media_retention_set', { p_on: on });
    setBusy(false);
    if (error) return toast(error.message, 'danger');
    toast(on ? `On. ${data?.listing_media_rows ?? 0} listing files and ${data?.chat_videos ?? 0} chat videos moved to trash.` : 'Turned off.', 'ok');
    load();
  }
  async function trashUnused() {
    if (!(await ask(`Move ${unusedFiles} unused files (${gb(unusedBytes)}) to the trash?\n\nThese belong to listings/posts/messages that no longer exist. They are deleted in 7 days unless you press "Undo".`, { danger: true, okText: 'Move to trash' }))) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_media_trash_unused');
    setBusy(false);
    if (error) return toast(error.message, 'danger');
    toast(`${data} files moved to trash.`, 'ok');
    load();
  }
  async function undo() {
    if (!(await ask(`Take all ${s.in_trash_files} files out of the trash? Listing photos and chat videos are put back.`, { okText: 'Undo' }))) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_media_untrash_all');
    setBusy(false);
    if (error) return toast(error.message, 'danger');
    toast(`${data} files taken out of the trash.`, 'ok');
    load();
  }

  const row = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--line)' } as const;
  return (
    <div>
      <p className="sub">Photos, videos and audio live in Cloudflare R2. The first 10 GB is free; above that it's about ₹1.25 per GB a month. Downloads are always free.</p>

      <div className="card">
        <div className="card-h"><h2><HardDrive size={16} /> Space used</h2></div>
        <div style={{ padding: 16, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div><div style={{ fontSize: 28, fontWeight: 800 }}>{gb(s.bucket_bytes)}</div><div className="sub" style={{ margin: 0 }}>of 10 GB free</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 700 }}>{(s.bucket_files ?? 0).toLocaleString('en-IN')}</div><div className="sub" style={{ margin: 0 }}>files</div></div>
          <div className="sub" style={{ margin: 0, marginLeft: 'auto' }}>Counted {s.scanned_at ? timeAgo(s.scanned_at) : 'never'} · recounted every Sunday</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2><Film size={16} /> {days}-day rule</h2>
          <span className={'badge ' + (s.retention_enabled ? 'b-ok' : 'b-danger')} style={{ marginLeft: 'auto' }}>{s.retention_enabled ? 'ON' : 'OFF'}</span></div>
        <div style={{ padding: 16, display: 'grid', gap: 8, fontSize: 13.5 }}>
          <div>• Listing photos & videos are removed {days} days after the listing was posted or last relisted. Live listings are never touched. Relisting resets the clock.</div>
          <div>• Chat videos are removed {days} days after they were sent.</div>
          <div>• The listing, its reviews, sales count and receipts stay.</div>
          <div style={{ marginTop: 6 }}>Right now this would free <b>{gb((p.listing_bytes ?? 0) + (p.chat_bytes ?? 0))}</b> — {p.listing_files ?? 0} listing files, {p.chat_videos ?? 0} chat videos.</div>
          <div>
            <button className="btn" disabled={busy} onClick={() => setRetention(!s.retention_enabled)}>
              {s.retention_enabled ? 'Turn off' : `Turn on the ${days}-day rule`}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2><Trash2 size={16} /> Leftover files nothing uses</h2></div>
        {unused.length === 0 && <div style={{ padding: 16 }} className="sub">None.</div>}
        {unused.map(u => (
          <div key={u.folder} style={row}><span>{FOLDER[u.folder] ?? u.folder}</span>
            <span className="sub" style={{ margin: 0, marginLeft: 'auto' }}>{u.files} files · {gb(u.bytes)}</span></div>
        ))}
        {unusedFiles > 0 && <div style={{ padding: 16 }}>
          <button className="btn" disabled={busy} onClick={trashUnused}>Move {unusedFiles} files ({gb(unusedBytes)}) to trash</button>
        </div>}
      </div>

      <div className="card">
        <div className="card-h"><h2><Clock size={16} /> Trash</h2></div>
        <div style={{ padding: 16, display: 'grid', gap: 8, fontSize: 13.5 }}>
          <div>{s.in_trash_files ?? 0} files ({gb(s.in_trash_bytes)}) waiting.
            {s.next_delete_at && <> First deletion: <b>{new Date(s.next_delete_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</b>.</>}</div>
          <div className="sub" style={{ margin: 0 }}>Deleted 7 days after entering the trash, only if nothing in the app still uses them.</div>
          {(s.in_trash_files ?? 0) > 0 && <div><button className="btn ghost sm" disabled={busy} onClick={undo}><RotateCcw size={14} /> Undo — take everything out of the trash</button></div>}
          {(s.last_runs ?? []).length > 0 && <div className="sub" style={{ margin: 0 }}>
            Last runs: {(s.last_runs as any[]).map(r => `${timeAgo(r.ran_at)}: ${r.deleted} deleted (${gb(r.bytes)})`).join(' · ')}</div>}
        </div>
      </div>
    </div>
  );
}
