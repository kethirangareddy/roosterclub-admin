import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Users as UsersIcon, ChevronLeft } from 'lucide-react';
import { Empty, Loading, UserLink } from '../ui';

/* Daily active users.
   users.last_seen_at only holds each person's LAST visit, so it can't answer
   "who was online on the 20th". user_daily_active logs one row per IST day per
   user instead — written live by trg_log_daily_active whenever the app pings,
   and backfilled from timestamped actions for days before the log existed.
   Those older days are marked "est." so you know which numbers are exact. */

type Day = { a_day: string; a_users: number; a_exact: number; a_new: number };
type Person = {
  u_id: string; u_full_name: string | null; u_handle: string | null;
  u_farm_name: string | null; u_state: string | null; u_district: string | null;
  u_badge: string | null; u_banned: boolean;
  u_first_seen: string; u_source: string; u_is_new: boolean;
};

const RANGES = [7, 30, 90] as const;

/** IST clock time — the day boundaries are Indian local, so the times should be too. */
function istTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });
}
function dayLabel(d: string) {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function fullDayLabel(d: string) {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function Online() {
  const [days, setDays] = useState<Day[]>([]);
  const [span, setSpan] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    supabase.rpc('admin_daily_active', { days: span }).then(({ data, error }) => {
      if (dead) return;
      if (error) alert('Could not load daily actives: ' + error.message);
      setDays((data as Day[]) || []); setLoading(false);
    });
    return () => { dead = true; };
  }, [span]);

  // Drill into one day. Kept separate from the chart load so switching days
  // doesn't re-fetch the whole range.
  useEffect(() => {
    if (!pickedDay) { setPeople([]); return; }
    let dead = false;
    setPeopleLoading(true);
    supabase.rpc('admin_active_users_on', { d: pickedDay }).then(({ data, error }) => {
      if (dead) return;
      if (error) alert('Could not load that day: ' + error.message);
      setPeople((data as Person[]) || []); setPeopleLoading(false);
    });
    return () => { dead = true; };
  }, [pickedDay]);

  const peak = Math.max(1, ...days.map(d => d.a_users));
  const today = days.length ? days[days.length - 1] : null;
  const avg = days.length ? Math.round(days.reduce((n, d) => n + d.a_users, 0) / days.length) : 0;
  const best = days.reduce<Day | null>((b, d) => (!b || d.a_users > b.a_users ? d : b), null);

  // ---- one day's roster ----
  if (pickedDay) {
    const newcomers = people.filter(p => p.u_is_new).length;
    return (
      <div className="card">
        <div className="card-h">
          <h2>
            <button className="btn ghost sm" onClick={() => setPickedDay(null)}>
              <ChevronLeft size={13} /> Back
            </button>
            <span style={{ marginLeft: 10 }}>{fullDayLabel(pickedDay)}</span>
          </h2>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {people.length} online{newcomers > 0 ? ` · ${newcomers} joined that day` : ''}
          </span>
        </div>
        {peopleLoading ? <Loading /> : people.length === 0 ? <Empty text="Nobody was online this day." /> : (
          <table>
            <thead><tr>
              <th>First seen</th><th>User</th><th>Where</th><th>Badge</th><th></th>
            </tr></thead>
            <tbody>
              {people.map(p => (
                <tr key={p.u_id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {istTime(p.u_first_seen)}
                  </td>
                  <td>
                    <UserLink id={p.u_id}>
                      <b>{p.u_full_name || (p.u_handle ? '@' + p.u_handle : 'View user')}</b>
                    </UserLink>
                    {p.u_farm_name && <div className="muted" style={{ fontSize: 11.5 }}>{p.u_farm_name}</div>}
                  </td>
                  <td className="muted">{[p.u_district, p.u_state].filter(Boolean).join(', ') || '—'}</td>
                  <td>{p.u_badge ? <span className="badge b-info">{p.u_badge}</span> : <span className="muted">—</span>}</td>
                  <td className="right">
                    {p.u_is_new && <span className="badge b-ok">new</span>}{' '}
                    {p.u_banned && <span className="badge b-danger">banned</span>}{' '}
                    {p.u_source !== 'app' && <span className="badge b-mut" title="Inferred from an action, not an app ping">est.</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // ---- the chart ----
  return (
    <div className="card">
      <div className="card-h">
        <h2><UsersIcon size={16} /> People online each day</h2>
        <div className="row-acts">
          {RANGES.map(r => (
            <button key={r} className={span === r ? 'btn sm' : 'btn ghost sm'} onClick={() => setSpan(r)}>
              {r}d
            </button>
          ))}
        </div>
      </div>
      {loading ? <Loading /> : days.length === 0 ? <Empty text="No activity logged yet." /> : (
        <>
          <div className="pulse" style={{ padding: '14px 18px 0', marginBottom: 0 }}>
            <div className="p-item"><span className="p-dot" /> Today <b className="p-val">{today?.a_users ?? 0}</b></div>
            <div className="p-item">Daily average <b className="p-val">{avg}</b></div>
            {best && <div className="p-item">Best day <b className="p-val">{best.a_users}</b>
              <span className="muted">{dayLabel(best.a_day)}</span></div>}
          </div>

          {/* Bars, not a chart library: each one is a button so the whole row is
              a tap target on a phone, which recharts can't give us cleanly. */}
          <div className="dau" role="list">
            {days.map(d => (
              <button key={d.a_day} className="dau-bar" role="listitem"
                onClick={() => setPickedDay(d.a_day)}
                title={`${fullDayLabel(d.a_day)} — ${d.a_users} online${d.a_new ? `, ${d.a_new} new` : ''}${d.a_exact === 0 && d.a_users > 0 ? ' (estimated)' : ''}`}>
                <span className="dau-n">{d.a_users}</span>
                <span className="dau-col" style={{ height: Math.max(3, Math.round((d.a_users / peak) * 100)) + '%' }}>
                  {/* new signups shown as a darker foot on the same bar */}
                  {d.a_new > 0 && (
                    <span className="dau-new" style={{ height: Math.round((d.a_new / Math.max(d.a_users, 1)) * 100) + '%' }} />
                  )}
                </span>
                <span className={'dau-d' + (d.a_exact === 0 && d.a_users > 0 ? ' est' : '')}>{dayLabel(d.a_day)}</span>
              </button>
            ))}
          </div>
          <div className="muted" style={{ padding: '0 18px 14px', fontSize: 11.5 }}>
            Days run 00:00–23:59 India time. Tap any bar for the list of who was online.
            The darker foot of each bar is people who signed up that day.
            Dates in italics are estimated from user actions — the exact log starts today.
          </div>
        </>
      )}
    </div>
  );
}
