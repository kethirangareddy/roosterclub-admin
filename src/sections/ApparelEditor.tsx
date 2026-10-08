// Command Center: the extra fields a printed tee needs (8 Oct 2026).
// Garment details go in shop_products.apparel (jsonb); sizes and their stock go in
// shop_product_variants, one row per colour × size. Print-on-demand stock is
// effectively unlimited, so new sizes default to 999; set 0 to show a size as sold out.
import { useState } from 'react';
import { supabase } from '../supabase';
import { Field } from '../ui';

export const SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];

export type ApparelColour = { key: string; name: string; name_te?: string; hex: string; images?: string[] };
export type ApparelState = {
  fit: 'regular' | 'oversized';
  benefit?: string; benefit_te?: string;
  fabric?: string; gsm?: number | string; print?: string; neck?: string; made_in?: string;
  badge?: '' | 'bestseller' | 'new' | 'limited';
  model?: { height?: string; size?: string; weight?: string };
  colours: ApparelColour[];
};
/** stock[colourKey][size] — a missing entry means that size isn't sold in that colour. */
export type StockGrid = Record<string, Record<string, number>>;

export const emptyApparel = (): ApparelState => ({
  fit: 'regular', benefit: '', benefit_te: '', fabric: '100% combed cotton, bio-washed', gsm: 180,
  print: 'Front, DTF print', neck: 'Round neck, ribbed collar', made_in: 'India', badge: '',
  model: { height: '', size: '', weight: '' },
  colours: [{ key: 'black', name: 'Black', name_te: 'నలుపు', hex: '#111111', images: [] }],
});

export function defaultGrid(a: ApparelState): StockGrid {
  const g: StockGrid = {};
  a.colours.forEach((c) => { g[c.key] = Object.fromEntries(SIZES.map((s) => [s, 999])); });
  return g;
}

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'colour';

/** Turn the editor state into the jsonb we store (numbers as numbers, blanks dropped). */
export function apparelPayload(a: ApparelState) {
  const m = a.model ?? {};
  return {
    fit: a.fit,
    benefit: a.benefit?.trim() || undefined, benefit_te: a.benefit_te?.trim() || undefined,
    fabric: a.fabric?.trim() || undefined, gsm: a.gsm === '' || a.gsm == null ? undefined : Number(a.gsm),
    print: a.print?.trim() || undefined, neck: a.neck?.trim() || undefined, made_in: a.made_in?.trim() || undefined,
    badge: a.badge || null,
    model: m.height?.trim() && m.size?.trim() ? { height: m.height.trim(), size: m.size.trim(), weight: m.weight?.trim() || undefined } : undefined,
    colours: a.colours.map((c) => ({ key: c.key, name: c.name.trim() || c.key, name_te: c.name_te?.trim() || undefined, hex: c.hex, images: c.images ?? [] })),
  };
}

/** Write the size grid: upsert every chosen colour × size, hide the rest (never delete — orders point at them). */
export async function saveVariants(productId: string, grid: StockGrid) {
  const { data: existing } = await supabase.from('shop_product_variants').select('id, colour, size').eq('product_id', productId);
  const rows: any[] = [];
  Object.entries(grid).forEach(([colour, sizes]) => {
    Object.entries(sizes).forEach(([size, stock]) => {
      rows.push({ product_id: productId, colour, size, stock_count: Math.max(0, Number(stock) || 0), active: true, sort: SIZES.indexOf(size) + 1 });
    });
  });
  if (rows.length) {
    const { error } = await supabase.from('shop_product_variants').upsert(rows, { onConflict: 'product_id,colour,size' });
    if (error) return error;
  }
  const keep = new Set(rows.map((r) => r.colour + '|' + r.size));
  const hide = (existing ?? []).filter((v: any) => !keep.has(v.colour + '|' + v.size)).map((v: any) => v.id);
  if (hide.length) {
    const { error } = await supabase.from('shop_product_variants').update({ active: false }).in('id', hide);
    if (error) return error;
  }
  return null;
}

export async function loadVariants(productId: string): Promise<StockGrid> {
  const { data } = await supabase.from('shop_product_variants').select('colour, size, stock_count, active').eq('product_id', productId);
  const g: StockGrid = {};
  (data ?? []).forEach((v: any) => { if (!v.active) return; (g[v.colour] ??= {})[v.size] = v.stock_count; });
  return g;
}

export function ApparelEditor({ value, onChange, grid, onGrid, upload }: {
  value: ApparelState; onChange: (a: ApparelState) => void;
  grid: StockGrid; onGrid: (g: StockGrid) => void;
  upload: (files: File[]) => Promise<string[]>;
}) {
  const a = value;
  const [busy, setBusy] = useState<string | null>(null);
  const set = (patch: Partial<ApparelState>) => onChange({ ...a, ...patch });
  const setColour = (i: number, patch: Partial<ApparelColour>) => {
    const colours = a.colours.map((c, j) => (j === i ? { ...c, ...patch } : c));
    onChange({ ...a, colours });
  };

  function addColour() {
    let key = 'colour-' + (a.colours.length + 1);
    while (a.colours.some((c) => c.key === key)) key += 'x';
    onChange({ ...a, colours: [...a.colours, { key, name: '', name_te: '', hex: '#5B1A1A', images: [] }] });
    onGrid({ ...grid, [key]: Object.fromEntries(SIZES.map((s) => [s, 999])) });
  }
  function renameColour(i: number, name: string) {
    // The key is fixed once a colour has variants saved; it only follows the name for brand-new colours.
    const c = a.colours[i];
    const fresh = c.key.startsWith('colour-');
    if (!fresh) { setColour(i, { name }); return; }
    let key = slug(name);
    if (a.colours.some((x, j) => j !== i && x.key === key)) key += '-' + i;
    const g = { ...grid, [key]: grid[c.key] ?? {} };
    if (key !== c.key) delete g[c.key];
    onGrid(g);
    setColour(i, { name, key: name.trim() ? key : c.key });
  }
  function removeColour(i: number) {
    if (a.colours.length <= 1) { alert('Keep at least one colour.'); return; }
    const c = a.colours[i];
    const g = { ...grid }; delete g[c.key];
    onGrid(g);
    onChange({ ...a, colours: a.colours.filter((_, j) => j !== i) });
  }
  async function addPhotos(i: number, files: File[]) {
    setBusy(a.colours[i].key);
    try {
      const urls = await upload(files);
      setColour(i, { images: [...(a.colours[i].images ?? []), ...urls].slice(0, 8) });
    } finally { setBusy(null); }
  }
  function toggleSize(ck: string, s: string) {
    const row = { ...(grid[ck] ?? {}) };
    if (s in row) delete row[s]; else row[s] = 999;
    onGrid({ ...grid, [ck]: row });
  }
  function setStock(ck: string, s: string, n: string) {
    onGrid({ ...grid, [ck]: { ...(grid[ck] ?? {}), [s]: Math.max(0, Number(n) || 0) } });
  }

  return (
    <div style={{ border: '1.5px solid #E8C97A', background: '#FFFBF2', borderRadius: 12, padding: 12, marginTop: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>👕 Apparel details</div>
      <div className="grid2">
        <Field label="Fit (decides the size chart)">
          <select value={a.fit} onChange={(e) => set({ fit: e.target.value as any })}>
            <option value="regular">Regular fit</option><option value="oversized">Oversized</option>
          </select>
        </Field>
        <Field label="Badge (one at a time)">
          <select value={a.badge ?? ''} onChange={(e) => set({ badge: e.target.value as any })}>
            <option value="">None</option><option value="bestseller">Bestseller</option><option value="new">New</option><option value="limited">Limited drop</option>
          </select>
        </Field>
      </div>
      <div className="grid2">
        <Field label="Short line under the name (English)"><input value={a.benefit ?? ''} onChange={(e) => set({ benefit: e.target.value })} placeholder="Vintage rooster print · heavy cotton" /></Field>
        <Field label="Short line (Telugu)"><input value={a.benefit_te ?? ''} onChange={(e) => set({ benefit_te: e.target.value })} /></Field>
      </div>
      <div className="grid2">
        <Field label="Fabric"><input value={a.fabric ?? ''} onChange={(e) => set({ fabric: e.target.value })} /></Field>
        <Field label="GSM (fabric weight)"><input type="number" value={a.gsm ?? ''} onChange={(e) => set({ gsm: e.target.value })} /></Field>
      </div>
      <div className="grid2">
        <Field label="Print"><input value={a.print ?? ''} onChange={(e) => set({ print: e.target.value })} placeholder="Front, DTF print" /></Field>
        <Field label="Neck"><input value={a.neck ?? ''} onChange={(e) => set({ neck: e.target.value })} /></Field>
      </div>
      <div className="grid2">
        <Field label={'Model height (e.g. 5\'10")'}><input value={a.model?.height ?? ''} onChange={(e) => set({ model: { ...a.model, height: e.target.value } })} /></Field>
        <Field label="Size the model wears"><input value={a.model?.size ?? ''} onChange={(e) => set({ model: { ...a.model, size: e.target.value } })} placeholder="M" /></Field>
      </div>
      <div className="grid2">
        <Field label="Model weight (optional)"><input value={a.model?.weight ?? ''} onChange={(e) => set({ model: { ...a.model, weight: e.target.value } })} placeholder="72 kg" /></Field>
        <Field label="Made in"><input value={a.made_in ?? ''} onChange={(e) => set({ made_in: e.target.value })} /></Field>
      </div>

      <div style={{ fontWeight: 700, margin: '12px 0 4px' }}>Colours, photos and sizes</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
        Photo order that sells best: front on a model → back or side → the print laid flat → print close-up → lifestyle. Tall 4:5 photos.
        A colour with no photos uses the main photos above. Tick the sizes sold in each colour; stock 999 = print on demand, 0 = sold out.
      </div>
      {a.colours.map((c, i) => (
        <div key={i} style={{ border: '1px solid #E3D9C9', borderRadius: 10, padding: 10, marginBottom: 8, background: '#fff' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label="Colour name"><input value={c.name} onChange={(e) => renameColour(i, e.target.value)} placeholder="Black" style={{ width: 130 }} /></Field>
            <Field label="Telugu"><input value={c.name_te ?? ''} onChange={(e) => setColour(i, { name_te: e.target.value })} style={{ width: 110 }} /></Field>
            <Field label="Swatch"><input type="color" value={c.hex} onChange={(e) => setColour(i, { hex: e.target.value })} style={{ width: 52, height: 34, padding: 2 }} /></Field>
            <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
              {busy === c.key ? 'Uploading…' : '+ Photos'}
              <input type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(i, Array.from(e.target.files ?? []))} onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} />
            </label>
            <button className="btn danger sm" onClick={() => removeColour(i)}>Remove colour</button>
          </div>
          {(c.images ?? []).length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {(c.images ?? []).map((u, k) => (
                <div key={u} style={{ textAlign: 'center' }}>
                  <img src={u} className="thumb" style={{ width: 48, height: 60, objectFit: 'cover', outline: k === 0 ? '2px solid #BA7517' : 'none' }} />
                  <div style={{ display: 'flex', gap: 2 }}>
                    {k !== 0 && <button className="btn ghost sm" onClick={() => setColour(i, { images: [u, ...(c.images ?? []).filter((x) => x !== u)] })}>1st</button>}
                    <button className="btn ghost sm" onClick={() => setColour(i, { images: (c.images ?? []).filter((x) => x !== u) })}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {SIZES.map((s) => {
              const on = s in (grid[c.key] ?? {});
              return (
                <div key={s} style={{ border: '1px solid ' + (on ? '#7B3F00' : '#E3D9C9'), borderRadius: 8, padding: '4px 6px', textAlign: 'center', minWidth: 58 }}>
                  <label style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', fontWeight: 700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => toggleSize(c.key, s)} /> {s}
                  </label>
                  {on && <input type="number" value={grid[c.key][s]} onChange={(e) => setStock(c.key, s, e.target.value)} style={{ width: 52, marginTop: 3 }} title="Stock (0 = sold out)" />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <button className="btn ghost sm" onClick={addColour}>+ Add colour</button>
    </div>
  );
}
