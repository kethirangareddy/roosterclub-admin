// Command Center: extra product-page content for accessories (8 Oct 2026).
// Saved to shop_products.details. A product that lists kit items becomes a starter kit:
// it shows up in the kit banner and on each item's page under "Bought together".
import { Field } from '../ui';

export type DetailsForm = {
  group: string; subtitle: string; subtitle_te: string; badge: string;
  good_for: string; ships_days: string; warranty: string;
  box: string; steps: string; specs: string; faq: string; kit_ids: string[];
};

export const GROUPS = [
  ['hatching', 'Hatching'], ['brooding', 'Brooding'], ['feed', 'Feed & water'], ['care', 'Care'],
  ['rings', 'Rings & ID'], ['travel', 'Travel'], ['farm', 'Farm'],
];

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

export function toForm(d: any): DetailsForm {
  d = d && typeof d === 'object' ? d : {};
  return {
    group: d.group ?? 'hatching', subtitle: d.subtitle ?? '', subtitle_te: d.subtitle_te ?? '', badge: d.badge ?? '',
    good_for: (d.good_for ?? []).join(', '), ships_days: d.ships_days != null ? String(d.ships_days) : '1', warranty: d.warranty ?? '',
    box: (d.box ?? []).join('\n'), steps: (d.steps ?? []).join('\n'),
    specs: (d.specs ?? []).map((r: [string, string]) => `${r[0]}: ${r[1]}`).join('\n'),
    faq: (d.faq ?? []).map((f: any) => `${f.q} | ${f.a}`).join('\n'),
    kit_ids: d.kit_ids ?? [],
  };
}

export function fromForm(f: DetailsForm) {
  const specs = lines(f.specs).map((l) => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, '']; });
  const faq = lines(f.faq).map((l) => { const [q, ...a] = l.split('|'); return { q: q.trim(), a: a.join('|').trim() }; }).filter((x) => x.q && x.a);
  return {
    group: f.kit_ids.length ? 'kit' : f.group,
    subtitle: f.subtitle.trim() || undefined, subtitle_te: f.subtitle_te.trim() || undefined,
    badge: f.badge || null,
    good_for: f.good_for.split(',').map((x) => x.trim()).filter(Boolean),
    ships_days: Math.max(1, Number(f.ships_days) || 1),
    warranty: f.warranty.trim() || undefined,
    box: lines(f.box), steps: lines(f.steps), specs, faq,
    kit_ids: f.kit_ids.length ? f.kit_ids : undefined,
  };
}

export function AccessoryEditor({ value, onChange, others }: {
  value: DetailsForm; onChange: (f: DetailsForm) => void; others: { id: string; name: string; price: number }[];
}) {
  const f = value;
  const set = (patch: Partial<DetailsForm>) => onChange({ ...f, ...patch });
  const worth = others.filter((o) => f.kit_ids.includes(o.id)).reduce((n, o) => n + (o.price || 0), 0);
  const ta = (k: keyof DetailsForm, label: string, ph: string, rows = 3) => (
    <Field label={label}><textarea rows={rows} value={f[k] as string} onChange={(e) => set({ [k]: e.target.value } as any)} placeholder={ph} /></Field>
  );
  return (
    <div style={{ border: '1.5px solid #E8C97A', background: '#FFFBF2', borderRadius: 12, padding: 12, marginTop: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>🧰 Accessory page details</div>
      <div className="grid2">
        <Field label="Group (shelf chip)">
          <select value={f.group} onChange={(e) => set({ group: e.target.value })} disabled={f.kit_ids.length > 0}>
            {GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Badge">
          <select value={f.badge} onChange={(e) => set({ badge: e.target.value })}>
            <option value="">None</option><option value="bestseller">Bestseller</option><option value="most_bought">Most bought</option><option value="new">New</option>
          </select>
        </Field>
      </div>
      <div className="grid2">
        <Field label="Short line under the name"><input value={f.subtitle} onChange={(e) => set({ subtitle: e.target.value })} placeholder="Auto turning · digital temp" /></Field>
        <Field label="Short line (Telugu)"><input value={f.subtitle_te} onChange={(e) => set({ subtitle_te: e.target.value })} /></Field>
      </div>
      <div className="grid2">
        <Field label="Good for (comma separated)"><input value={f.good_for} onChange={(e) => set({ good_for: e.target.value })} placeholder="48 hen eggs, 30 duck eggs, Auto turning" /></Field>
        <Field label="Warranty (blank = none)"><input value={f.warranty} onChange={(e) => set({ warranty: e.target.value })} placeholder="6 months" /></Field>
      </div>
      <div className="grid2">
        <Field label="Ships in (days)"><input type="number" value={f.ships_days} onChange={(e) => set({ ships_days: e.target.value })} /></Field>
        <div />
      </div>
      {ta('box', "In the box (one per line)", 'Incubator body + lid\nEgg tray\nPower cable')}
      {ta('steps', 'How to use (one step per line, in order)', 'Switch on, fill water\nPut eggs in, pointed end down', 4)}
      {ta('specs', 'Details (Label: value, one per line)', 'Capacity: 48 hen eggs\nPower: 220V, 80W', 4)}
      {ta('faq', 'Questions (Question | Answer, one per line)', 'Will it work in a power cut? | Keeps heat about 30 minutes.', 3)}

      <div style={{ fontWeight: 700, margin: '10px 0 4px' }}>Make this a starter kit (optional)</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
        Tick the products inside. Set this product's price below their total to show a saving.
        {f.kit_ids.length > 0 && <> Items total <b>₹{worth.toLocaleString('en-IN')}</b>.</>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {others.map((o) => {
          const on = f.kit_ids.includes(o.id);
          return (
            <label key={o.id} style={{ border: '1px solid ' + (on ? '#7B3F00' : '#E3D9C9'), borderRadius: 8, padding: '4px 8px', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', background: '#fff' }}>
              <input type="checkbox" checked={on} onChange={() => set({ kit_ids: on ? f.kit_ids.filter((x) => x !== o.id) : [...f.kit_ids, o.id] })} />
              {o.name} <span className="muted">₹{o.price}</span>
            </label>
          );
        })}
        {others.length === 0 && <span className="muted">Add a few accessories first.</span>}
      </div>
    </div>
  );
}
