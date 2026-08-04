/* Drill-down plumbing shared by every section.

   Sections never own the 360 modals — they just call openUser/openListing/
   openReceipt from context. App.tsx holds the stack and renders the modals,
   so a link buried nine components deep still works without prop-drilling. */
import { createContext, useContext } from 'react';

export type DetailKind = 'user' | 'listing' | 'receipt';
export type Detail = { kind: DetailKind; id: string };

export type DetailApi = {
  openUser: (id?: string | null) => void;
  openListing: (id?: string | null) => void;
  openReceipt: (id?: string | null) => void;
  /** Jump to a section (optionally with filter params), e.g. go('orders',{q:'…'}). */
  go: (key: string, qp?: Record<string, string>) => void;
};

const noop = () => {};
export const DetailCtx = createContext<DetailApi>({
  openUser: noop, openListing: noop, openReceipt: noop, go: noop,
});

export function useDetail(){ return useContext(DetailCtx); }

/* ---- URL <-> stack, so a 360 is bookmarkable and Back closes it ---- */
export function encodeDetail(stack: Detail[]){
  return stack.map(d => d.kind + '~' + d.id).join('!');
}
export function decodeDetail(raw: string | null): Detail[]{
  if(!raw) return [];
  return raw.split('!').flatMap(part => {
    const i = part.indexOf('~');
    if(i < 0) return [];
    const kind = part.slice(0, i) as DetailKind;
    const id = part.slice(i + 1);
    return (kind==='user'||kind==='listing'||kind==='receipt') && id ? [{ kind, id }] : [];
  });
}
