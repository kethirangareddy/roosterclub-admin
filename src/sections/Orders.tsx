import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { PackageCheck } from 'lucide-react';
import { Empty, Loading, inr, timeAgo, Modal, WaButton, UserLink, Copyable } from '../ui';

// Mirrors the check constraint on shop_orders.status. 'cancelled' sits outside the
// happy path so it isn't offered as a "next step" button.
// Prepaid (UPI) orders — printed tees — start at awaiting_payment, move to
// payment_review when the buyer sends the UPI reference, and to confirmed once we
// see the money. Cash orders start at pending as before.
const FLOW = ['pending', 'confirmed', 'packed', 'shipped', 'delivered'] as const;
const ALL = ['awaiting_payment', 'payment_review', ...FLOW, 'cancelled'] as const;
type Status = typeof ALL[number];
const OPEN: Status[] = ['payment_review', 'pending', 'confirmed', 'packed', 'shipped'];

const LABEL: Record<Status, string> = {
  awaiting_payment: 'Waiting for UPI', payment_review: 'Check payment',
  pending: 'New', confirmed: 'Confirmed', packed: 'Packed',
  shipped: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled',
};
const BADGE: Record<Status, string> = {
  awaiting_payment: 'b-mut', payment_review: 'b-warn',
  pending: 'b-warn', confirmed: 'b-mut', packed: 'b-mut',
  shipped: 'b-mut', delivered: 'b-ok', cancelled: 'b-bad',
};

export default function Orders() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | Status>('open');
  const [open, setOpen] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  // Where buyers pay for prepaid (UPI) orders. Empty UPI ID = online payment closed.
  const [pay, setPay] = useState<{ upi_id: string; payee_name: string; pay_hours: number } | null>(null);

  useEffect(() => { load(); }, [filter]);
  useEffect(() => {
    supabase.from('app_config').select('value').eq('key', 'shop_pay').maybeSingle()
      .then(({ data }) => setPay({ upi_id: '', payee_name: 'Rooster Club', pay_hours: 24, ...((data as any)?.value ?? {}) }));
  }, []);

  async function savePay() {
    if (!pay) return;
    const upi = pay.upi_id.trim();
    if (upi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) { alert('That does not look like a UPI ID (like name@okhdfcbank).'); return; }
    const value = { upi_id: upi, payee_name: pay.payee_name.trim() || 'Rooster Club', pay_hours: Math.max(1, Number(pay.pay_hours) || 24) };
    const { error } = await supabase.from('app_config').upsert({ key: 'shop_pay', value }, { onConflict: 'key' });
    if (error) { alert('Could not save: ' + error.message); return; }
    alert(upi ? 'Saved. Buyers can now pay by UPI.' : 'Saved. UPI payments are closed.');
  }

  async function load() {
    setLoading(true);
    let q = supabase
      .from('shop_orders')
      .select('*, shop_order_items(*)')
      .order('created_at', { ascending: false })
      .limit(300);
    // "Open" is the triage view: everything that still needs us to do something.
    if (filter === 'open') q = q.in('status', OPEN);
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
    if (s === 'payment_review') return 'confirmed';
    const i = FLOW.indexOf(s as any);
    return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
  }

  const openCount = rows.filter((r) => OPEN.includes(r.status)).length;
  const revenue = rows.filter((r) => r.status !== 'cancelled').reduce((n, r) => n + (r.total || 0), 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2><PackageCheck size={18} style={{ verticalAlign: -3 }} /> Orders</h2>
          <p className="sub">
            Shop orders: cash on delivery, and UPI for printed tees. {openCount} open · {inr(revenue)} in view.
          </p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="open">Open (needs action)</option>
          <option value="all">All</option>
          {ALL.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </select>
      </div>

      {pay && (
        <div className="card" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, width: '100%' }}>UPI for printed tees {pay.upi_id ? '· open' : '· closed until you add a UPI ID'}</div>
          <label style={{ display: 'grid', gap: 2 }}>UPI ID<input value={pay.upi_id} onChange={(e) => setPay({ ...pay, upi_id: e.target.value })} placeholder="name@okhdfcbank" /></label>
          <label style={{ display: 'grid', gap: 2 }}>Name buyers see<input value={pay.payee_name} onChange={(e) => setPay({ ...pay, payee_name: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 2 }}>Close unpaid after (hours)<input type="number" value={pay.pay_hours} onChange={(e) => setPay({ ...pay, pay_hours: Number(e.target.value) })} style={{ width: 90 }} /></label>
          <button className="btn sm" onClick={savePay}>Save</button>
        </div>
      )}

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
                      <UserLink id={r.buyer_id}>{r.contact_name || 'View buyer'}</UserLink><br />
                      <span className="mut"><Copyable value={r.contact_phone} title="Copy phone number"/></span>{' '}
                      <WaButton phone={r.contact_phone} label="WhatsApp" />
                    </td>
                    <td>{items.reduce((n: number, i: any) => n + i.qty, 0)}</td>
                    <td><strong>{inr(r.total)}</strong></td>
                    <td>{[r.village, r.mandal, r.district].filter(Boolean).join(', ') || '—'}</td>
                    <td>
                      <span className={'badge ' + BADGE[r.status as Status]}>{LABEL[r.status as Status]}</span>
                      {r.payment_method === 'upi' && <><br /><span className="mut">UPI{r.upi_ref ? ' · ' + r.upi_ref : ''}</span></>}
                    </td>
                    <td>{timeAgo(r.created_at)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sm" onClick={() => setOpen(r)}>Open</button>{' '}
                      {next && (
                        <button className="btn sm" disabled={saving} onClick={() => setStatus(r, next)}>
                          → {r.status === 'payment_review' ? 'Payment received' : LABEL[next]}
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
                      <td>
                        {i.name}{i.brand ? <><br /><span className="mut">{i.brand}</span></> : null}
                        {i.size ? <><br /><strong>Size {i.size}</strong>{i.colour ? ` · ${i.colour}` : ''}</> : null}
                      </td>
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
                {' · '}<strong>Total {inr(open.total)}</strong> · {open.payment_method === 'upi'
                  ? <>UPI{open.upi_ref ? <> · ref <Copyable value={open.upi_ref} title="Copy UPI reference" /></> : ' · not paid yet'}{open.paid_at ? ' · paid ' + timeAgo(open.paid_at) : ''}</>
                  : 'Cash on delivery'}
              </p>
              {open.status === 'payment_review' && (
                <div className="card" style={{ marginTop: 8, padding: 12, borderColor: '#BA7517' }}>
                  <strong>Check your bank / UPI app for {inr(open.total)} with reference {open.upi_ref}.</strong>
                  <p className="sub" style={{ margin: '4px 0 8px' }}>Only confirm once the money is in. Confirming tells the buyer and sends the tee to print.</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn sm primary" disabled={saving} onClick={() => setStatus(open, 'confirmed')}>Payment received</button>
                    <button className="btn sm" disabled={saving} onClick={() => setStatus(open, 'awaiting_payment')}>Not received</button>
                  </div>
                </div>
              )}
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
