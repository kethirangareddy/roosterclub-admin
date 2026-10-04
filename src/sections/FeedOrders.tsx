import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Wheat } from 'lucide-react';
import { Empty, Loading, inr, timeAgo, Modal, WaButton, UserLink, Copyable } from '../ui';

// Make My Feed: farmers design a feed in the app; Protein Factory mills it in 10 kg sacks.
// Orders are paid by UPI in advance: the farmer sends the UPI reference, we check it here,
// then move the order along. Every step sends the farmer a push.
const FLOW = ['awaiting_payment', 'payment_review', 'paid', 'milling', 'packed', 'shipped', 'delivered'] as const;
type Status = typeof FLOW[number] | 'cancelled';
const LABEL: Record<Status, string> = {
  awaiting_payment: 'Waiting for payment', payment_review: 'Check payment', paid: 'Paid', milling: 'Milling',
  packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};
const BADGE: Record<Status, string> = {
  awaiting_payment: 'b-mut', payment_review: 'b-warn', paid: 'b-warn', milling: 'b-mut', packed: 'b-mut', shipped: 'b-mut', delivered: 'b-ok', cancelled: 'b-bad',
};
const STAGE: Record<string, string> = { chick: 'Chicks', grower: 'Growers', layer: 'Laying hens', breeder: 'Breeding hens', adult: 'Adult cocks' };
const en = (t: any) => (t && (t.en || t.te)) || '';

export default function FeedOrders() {
  const [tab, setTab] = useState<'orders' | 'mill'>('orders');
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2><Wheat size={18} style={{ verticalAlign: -3 }} /> Make My Feed</h2>
          <p className="sub">Custom feed milled in 10 kg sacks. UPI paid in advance.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={'btn sm' + (tab === 'orders' ? ' primary' : '')} onClick={() => setTab('orders')}>Orders</button>
          <button className={'btn sm' + (tab === 'mill' ? ' primary' : '')} onClick={() => setTab('mill')}>Mill prices & settings</button>
        </div>
      </div>
      {tab === 'orders' ? <OrdersTab /> : <MillTab />}
    </>
  );
}

function OrdersTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'all' | Status>('open');
  const [open, setOpen] = useState<any | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [filter]);
  async function load() {
    setLoading(true);
    let q = supabase.from('custom_feed_orders').select('*').order('created_at', { ascending: false }).limit(300);
    if (filter === 'open') q = q.in('status', ['payment_review', 'paid', 'milling', 'packed', 'shipped']);
    else if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q;
    setLoading(false);
    if (error) { alert('Could not load: ' + error.message); return; }
    setRows(data ?? []);
  }
  async function setStatus(o: any, s: Status) {
    if (s === 'cancelled' && !confirm(`Cancel ${o.order_no}? Refund any payment yourself by UPI.`)) return;
    if (s === 'awaiting_payment' && !confirm('Mark payment as NOT found? The farmer is asked to check and pay again.')) return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_set_custom_feed_status', { p_order: o.id, p_status: s, p_note: note || null });
    setSaving(false);
    if (error) { alert('Could not update: ' + error.message); return; }
    setOpen(null); setNote(''); load();
  }
  const next = (s: Status): Status | null => {
    const i = FLOW.indexOf(s as any);
    return i >= 1 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
  };
  const toMill = rows.filter((r) => ['paid', 'milling'].includes(r.status));
  const kgToMill = toMill.reduce((n, r) => n + r.sacks * 10, 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', gap: 12, flexWrap: 'wrap' }}>
        <p className="sub" style={{ margin: 0 }}>{rows.filter((r) => r.status === 'payment_review').length} payments to check · {kgToMill} kg to mill</p>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="open">Open (needs action)</option>
          <option value="all">All</option>
          {[...FLOW, 'cancelled'].map((s) => <option key={s} value={s}>{LABEL[s as Status]}</option>)}
        </select>
      </div>
      <div className="card">
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No feed orders here." /> : (
          <table className="tbl">
            <thead><tr><th>Order</th><th>Farmer</th><th>Feed</th><th>Sacks</th><th>Total</th><th>UPI ref</th><th>Status</th><th>Placed</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const nx = next(r.status);
                return (
                  <tr key={r.id}>
                    <td><Copyable value={r.order_no}><strong>{r.order_no}</strong></Copyable></td>
                    <td><UserLink id={r.user_id}>{r.contact_name}</UserLink><br /><span className="mut">{r.district}, {r.state}</span></td>
                    <td>{STAGE[r.stage] ?? r.stage} · {r.protein}% · {r.form}</td>
                    <td>{r.sacks}</td>
                    <td><strong>{inr(r.total)}</strong></td>
                    <td>{r.upi_ref ? <Copyable value={r.upi_ref} /> : <span className="mut">—</span>}</td>
                    <td><span className={'badge ' + BADGE[r.status as Status]}>{LABEL[r.status as Status]}</span></td>
                    <td>{timeAgo(r.created_at)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sm" onClick={() => { setOpen(r); setNote(''); }}>Open</button>{' '}
                      {nx && <button className="btn sm" disabled={saving} onClick={() => setStatus(r, nx)}>→ {r.status === 'payment_review' ? 'Payment OK' : LABEL[nx]}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title={`Feed order ${open.order_no}`} onClose={() => setOpen(null)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div id="batch-sheet">
              <strong>Batch sheet · {open.order_no}</strong>
              <p className="sub" style={{ margin: '4px 0' }}>
                {STAGE[open.stage] ?? open.stage} · protein {open.protein}% · {open.form === 'pellet' ? 'PELLET' : 'MASH'} · {open.sacks} sacks × 10 kg = {open.sacks * 10} kg
              </p>
              <table className="tbl">
                <thead><tr><th>Ingredient</th><th>%</th><th>Per sack</th><th>Whole batch</th></tr></thead>
                <tbody>
                  {(open.parts ?? []).map((p: any) => (
                    <tr key={p.key}><td>{en(p.name)}</td><td>{p.pct}%</td><td>{Number(p.kg_per_sack).toFixed(3)} kg</td>
                      <td><strong>{(Number(p.kg_per_sack) * open.sacks).toFixed(2)} kg</strong></td></tr>
                  ))}
                  {(open.addons ?? []).map((a: any) => (
                    <tr key={a.key}><td>+ {en(a.name)}</td><td colSpan={2}>per sack dose</td><td>{open.sacks} doses</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="sub" style={{ marginTop: 6 }}>
                Energy {open.nutrients?.me} kcal/kg · Protein {open.nutrients?.cp}% · Calcium {open.nutrients?.ca}% · Av. P {open.nutrients?.avp}% ·
                Lysine {open.nutrients?.lys}% · Methionine {open.nutrients?.met}% · Fibre {open.nutrients?.cf}% · Salt {open.nutrients?.salt}%
              </p>
              <p className="sub">Bag label: {open.contact_name} · {open.order_no} · {STAGE[open.stage] ?? open.stage} {open.protein}% · milled {new Date().toLocaleDateString('en-IN')}</p>
            </div>
            <button className="btn sm" onClick={() => printSheet()}>Print batch sheet</button>

            <div>
              <strong>Money</strong>
              <p className="sub" style={{ margin: '4px 0 0' }}>
                {open.sacks} × {inr(open.price_per_sack)} = {inr(open.subtotal)} · Delivery {open.delivery_fee ? inr(open.delivery_fee) : 'FREE'} · <strong>Total {inr(open.total)}</strong>
                <br />UPI ref: {open.upi_ref ? <Copyable value={open.upi_ref} /> : 'not sent yet'}
              </p>
            </div>
            <div>
              <strong>Deliver to</strong>
              <p className="sub" style={{ margin: '4px 0 0' }}>
                {open.contact_name} · <Copyable value={open.contact_phone} /><br />
                {[open.address_line, open.village, open.mandal, open.district, open.state, open.pincode].filter(Boolean).join(', ')}
              </p>
              <div style={{ marginTop: 6 }}><WaButton phone={open.contact_phone} label="Message the farmer" /></div>
            </div>
            <div>
              <strong>Status</strong>
              <input placeholder="Note to farmer (optional, shown when cancelling)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {[...FLOW, 'cancelled'].map((s) => (
                  <button key={s} className={'btn sm' + (open.status === s ? ' primary' : '')} disabled={saving || open.status === s} onClick={() => setStatus(open, s as Status)}>
                    {LABEL[s as Status]}
                  </button>
                ))}
              </div>
              <p className="sub" style={{ marginTop: 6 }}>Check the UPI reference in your bank app before marking Paid. Delivered adds the cost to the farmer's Khata.</p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function printSheet() {
  const el = document.getElementById('batch-sheet');
  if (!el) return;
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  w.document.write(`<html><head><title>Batch sheet</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px;text-align:left}</style></head><body>${el.innerHTML}</body></html>`);
  w.document.close(); w.focus(); w.print();
}

function MillTab() {
  const [ings, setIngs] = useState<any[] | null>(null);
  const [mill, setMill] = useState<Record<string, { price: string; in_stock: boolean }>>({});
  const [addons, setAddons] = useState<any[]>([]);
  const [cfg, setCfg] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    const [a, b, c, d] = await Promise.all([
      supabase.from('feed_ingredients').select('key,name,grp,home,sort').eq('active', true).order('sort'),
      supabase.from('mill_ingredients').select('*'),
      supabase.from('mill_addons').select('*').order('sort'),
      supabase.from('app_config').select('value').eq('key', 'custom_feed').maybeSingle(),
    ]);
    if (a.error || b.error || c.error) { alert('Could not load mill data'); return; }
    setIngs((a.data ?? []).filter((i: any) => !i.home));
    const m: any = {};
    for (const r of b.data ?? []) m[r.key] = { price: String(r.price_per_kg), in_stock: r.in_stock };
    setMill(m);
    setAddons(c.data ?? []);
    setCfg((d.data as any)?.value ?? {});
  }
  async function save() {
    setSaving(true);
    const rows = Object.entries(mill).filter(([, v]) => Number(v.price) > 0)
      .map(([key, v]) => ({ key, price_per_kg: Number(v.price), in_stock: v.in_stock, updated_at: new Date().toISOString() }));
    const r1 = await supabase.from('mill_ingredients').upsert(rows);
    const r2 = await supabase.from('mill_addons').upsert(addons.map((a) => ({ ...a, price_per_sack: Number(a.price_per_sack) })));
    const r3 = await supabase.from('app_config').update({ value: cfg, updated_at: new Date().toISOString() }).eq('key', 'custom_feed');
    setSaving(false);
    const err = r1.error || r2.error || r3.error;
    if (err) alert('Could not save: ' + err.message); else { alert('Saved'); load(); }
  }
  if (!ings || !cfg) return <Loading />;
  const num = (path: string[], v: string) => {
    const c = JSON.parse(JSON.stringify(cfg)); let o = c;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] ?? {};
    o[path[path.length - 1]] = Number(v) || 0; setCfg(c);
  };
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
      <div className="card">
        <strong>Payment and pricing</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginTop: 8 }}>
          <label>UPI ID<br /><input value={cfg.upi_id ?? ''} onChange={(e) => setCfg({ ...cfg, upi_id: e.target.value.trim() })} placeholder="name@bank" /></label>
          <label>Payee name<br /><input value={cfg.payee_name ?? ''} onChange={(e) => setCfg({ ...cfg, payee_name: e.target.value })} /></label>
          <label>Milling fee per sack, mash (₹)<br /><input type="number" value={cfg.mill_fee?.mash ?? 0} onChange={(e) => num(['mill_fee', 'mash'], e.target.value)} /></label>
          <label>Milling fee per sack, pellet (₹)<br /><input type="number" value={cfg.mill_fee?.pellet ?? 0} onChange={(e) => num(['mill_fee', 'pellet'], e.target.value)} /></label>
          <label>Bag per sack (₹)<br /><input type="number" value={cfg.bag_fee ?? 0} onChange={(e) => num(['bag_fee'], e.target.value)} /></label>
          <label>Margin %<br /><input type="number" value={cfg.margin_pct ?? 0} onChange={(e) => num(['margin_pct'], e.target.value)} /></label>
          <label>Delivery per sack, Telangana (₹)<br /><input type="number" value={cfg.delivery_per_sack?.Telangana ?? 0} onChange={(e) => num(['delivery_per_sack', 'Telangana'], e.target.value)} /></label>
          <label>Delivery per sack, Andhra Pradesh (₹)<br /><input type="number" value={cfg.delivery_per_sack?.['Andhra Pradesh'] ?? 0} onChange={(e) => num(['delivery_per_sack', 'Andhra Pradesh'], e.target.value)} /></label>
          <label>Free delivery from (sacks)<br /><input type="number" value={cfg.free_delivery_sacks ?? 0} onChange={(e) => num(['free_delivery_sacks'], e.target.value)} /></label>
          <label>Most sacks per order<br /><input type="number" value={cfg.max_sacks ?? 100} onChange={(e) => num(['max_sacks'], e.target.value)} /></label>
          <label>Days to ship<br /><input type="number" value={cfg.days_to_ship ?? 3} onChange={(e) => num(['days_to_ship'], e.target.value)} /></label>
          <label><input type="checkbox" checked={cfg.pro_only !== false} onChange={(e) => setCfg({ ...cfg, pro_only: e.target.checked })} /> Farmer Pro members only</label>
        </div>
      </div>
      <div className="card">
        <strong>Ingredient prices at the mill (₹ per kg)</strong>
        <p className="sub">Only ticked ingredients are offered to farmers. Leave the price empty if you never stock it.</p>
        <table className="tbl"><tbody>
          {ings.map((i) => {
            const v = mill[i.key] ?? { price: '', in_stock: false };
            return (
              <tr key={i.key}>
                <td>{en(i.name)}</td><td className="mut">{i.grp}</td>
                <td><input type="number" style={{ width: 90 }} value={v.price} onChange={(e) => setMill({ ...mill, [i.key]: { ...v, price: e.target.value } })} /></td>
                <td><label><input type="checkbox" checked={v.in_stock} onChange={(e) => setMill({ ...mill, [i.key]: { ...v, in_stock: e.target.checked } })} /> in stock</label></td>
              </tr>
            );
          })}
        </tbody></table>
      </div>
      <div className="card">
        <strong>Extras (₹ per sack)</strong>
        <table className="tbl"><tbody>
          {addons.map((a, k) => (
            <tr key={a.key}>
              <td>{en(a.name)}{a.always ? <span className="mut"> · every sack</span> : null}</td>
              <td><input type="number" style={{ width: 90 }} value={a.price_per_sack} onChange={(e) => { const n = [...addons]; n[k] = { ...a, price_per_sack: e.target.value }; setAddons(n); }} /></td>
              <td><label><input type="checkbox" checked={a.active} onChange={(e) => { const n = [...addons]; n[k] = { ...a, active: e.target.checked }; setAddons(n); }} /> offered</label></td>
            </tr>
          ))}
        </tbody></table>
      </div>
      <div><button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save all'}</button></div>
    </div>
  );
}
