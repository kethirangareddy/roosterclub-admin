import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { PackageCheck } from 'lucide-react';
import { Empty, Loading, inr, timeAgo, Modal, WaButton, UserLink, Copyable } from '../ui';

// Mirrors the check constraint on shop_orders.status. 'cancelled' sits outside the
// happy path so it isn't offered as a "next step" button.
const FLOW = ['pending', 'confirmed', 'packed', 'shipped', 'delivered'] as const;
const ALL = [...FLOW, 'cancelled'] as const;
type Status = typeof ALL[number];

const LABEL: Record<Status, string> = {
  pending: 'New', confirmed: 'Confirmed', packed: 'Packed',
  shipped: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled',
};
const BADGE: Record<Status, string> = {
  pending: 'b-warn', confirmed: 'b-mut', packed: 'b-mut',
  shipped: 'b-mut', delivered: 'b-ok', cancelled: 'b-bad',
};

export default function Orders() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | Status>('open');
  const [open, setOpen] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    let q = supabase
      .from('shop_orders')
      .select('*, shop_order_items(*)')
      .order('created_at', { ascending: false })
      .limit(300);
    // "Open" is the triage view: everything that still needs us to do something.
    if (filter === 'open') q = q.in('status', ['pending', 'confirmed', 'packed', 'shipped']);
    else if (filter !== 'all') q = q.eq('status', filter);

    const { data, error } = await q;
    setLoading(false);
    if (error) { alert('Could not load orders: ' + error.message); return; }
    setRows(data ?? []);
  }

  async function setStatus(order: any, status: Status) {
    if (status === 'cancelled' && !confirm(`Cancel ${order.order_no}? Stock goes back on the shelf.`)) return;
    setSaving(true);
    const { error } = await supabase.rpc('set_shop_order_status', { p_order: order.id, p_status: status });
    setSaving(false);
    if (error) { alert('Could not update: ' + error.message); return; }
    setOpen(null);
    load();
  }

  function nextStatus(s: Status): Status | null {
    const i = FLOW.indexOf(s as any);
    return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
  }

  const openCount = rows.filter((r) => ['pending', 'confirmed', 'packed', 'shipped'].includes(r.status)).length;
  const revenue = rows.filter((r) => r.status !== 'cancelled').reduce((n, r) => n + (r.total || 0), 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2><PackageCheck size={18} style={{ verticalAlign: -3 }} /> Orders</h2>
          <p className="sub">
            Shop orders, cash on delivery. {openCount} open · {inr(revenue)} in view.
          </p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="open">Open (needs action)</option>
          <option value="all">All</option>
          {ALL.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No orders here yet." /> : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Order</th><th>Customer</th><th>Items</th><th>Total</th>
                <th>Where</th><th>Status</th><th>Placed</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const items = r.shop_order_items ?? [];
                const next = nextStatus(r.status);
                return (
                  <tr key={r.id}>
                    <td><Copyable value={r.order_no} title="Copy order number"><strong>{r.order_no}</strong></Copyable></td>
                    <td>
                      {/* buyer opens User-360; the phone copies on tap */}
                      <UserLink id={r.user_id}>{r.contact_name || 'View buyer'}</UserLink><br />
                      <span className="mut"><Copyable value={r.contact_phone} title="Copy phone number"/></span>{' '}
                      <WaButton phone={r.contact_phone} label="WhatsApp" />
                    </td>
                    <td>{items.reduce((n: number, i: any) => n + i.qty, 0)}</td>
                    <td><strong>{inr(r.total)}</strong></td>
                    <td>{[r.village, r.mandal, r.district].filter(Boolean).join(', ') || '—'}</td>
                    <td><span className={'badge ' + BADGE[r.status as Status]}>{LABEL[r.status as Status]}</span></td>
                    <td>{timeAgo(r.created_at)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sm" onClick={() => setOpen(r)}>Open</button>{' '}
                      {next && (
                        <button className="btn sm" disabled={saving} onClick={() => setStatus(r, next)}>
                          → {LABEL[next]}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title={`Order ${open.order_no}`} onClose={() => setOpen(null)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <strong>Items</strong>
              <table className="tbl" style={{ marginTop: 6 }}>
                <tbody>
                  {(open.shop_order_items ?? []).map((i: any) => (
                    <tr key={i.id}>
                      <td>{i.image_url ? <img className="thumb" src={i.image_url} /> : <div className="thumb" />}</td>
                      <td>{i.name}{i.brand ? <><br /><span className="mut">{i.brand}</span></> : null}</td>
                      <td>{inr(i.unit_price)}{i.unit ? ` / ${i.unit}` : ''}</td>
                      <td>× {i.qty}</td>
                      <td><strong>{inr(i.line_total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <strong>Money</strong>
              <p className="sub" style={{ margin: '4px 0 0' }}>
                Subtotal {inr(open.subtotal)} · Delivery {open.delivery_fee === 0 ? 'FREE' : inr(open.delivery_fee)}
                {' · '}<strong>Total {inr(open.total)}</strong> · Cash on delivery
              </p>
            </div>

            <div>
              <strong>Deliver to</strong>
              <p className="sub" style={{ margin: '4px 0 0' }}>
                {open.contact_name} · {open.contact_phone}<br />
                {[open.address_line, open.village, open.mandal, open.district, open.state, open.pincode]
                  .filter(Boolean).join(', ')}
                {open.note ? <><br /><em>Note: {open.note}</em></> : null}
              </p>
              <div style={{ marginTop: 6 }}><WaButton phone={open.contact_phone} label="Message the buyer" /></div>
            </div>

            <div>
              <strong>Status</strong>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {ALL.map((s) => (
                  <button
                    key={s}
                    className={'btn sm' + (open.status === s ? ' primary' : '')}
                    disabled={saving || open.status === s}
                    onClick={() => setStatus(open, s)}
                  >
                    {LABEL[s]}
                  </button>
                ))}
              </div>
              <p className="sub" style={{ marginTop: 6 }}>
                Cancelling puts every item back into stock and notifies the buyer.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
