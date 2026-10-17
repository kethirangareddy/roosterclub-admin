/* In-page feedback: toasts + confirm/prompt dialogs.

   Replaces the browser's alert()/confirm()/prompt(). Those froze the whole
   page, looked like an error from the browser rather than the app, and on
   phones were easy to tap through by accident. */
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Tone = 'ok' | 'danger' | 'info';
type Toast = { id: number; text: string; tone: Tone };
type Ask = {
  id: number; text: string; danger: boolean; okText: string; cancelText: string;
  input?: { value: string }; dismissNull?: boolean; resolve: (v: any) => void;
};

let toasts: Toast[] = [];
let asks: Ask[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
let seq = 0;

// Guess the tone from the wording so the 140 existing call sites need no edits.
function toneOf(text: string): Tone {
  const t = text.toLowerCase();
  const failedZero = /\bfailed:?\s*0\b|\b0 failed\b/.test(t);
  if (/(could ?n.?t|cannot|can't|error|not allowed|denied|invalid|required|missing|too (big|large|long)|must )/.test(t)
      || (/failed/.test(t) && !failedZero)) return 'danger';
  if (/(done|saved|sent|delivered|approved|updated|removed|deleted|added|created|copied|✓|restored|posted|queued|scheduled)/.test(t)) return 'ok';
  return 'info';
}

export function toast(msg: unknown, tone?: Tone) {
  const text = String(msg ?? '');
  const t: Toast = { id: ++seq, text, tone: tone || toneOf(text) };
  toasts = [...toasts.slice(-3), t];
  emit();
  setTimeout(() => { toasts = toasts.filter(x => x.id !== t.id); emit(); }, t.tone === 'danger' ? 7000 : 3500);
}

const DANGER_WORDS = /(delete|remove|ban|reject|cancel|end |dismiss|not found|permanent)/i;

/** await ask('Delete this?') → true / false. Red button when the action is destructive. */
const pendingAsk = new Map<string, Promise<any>>();
/** await ask('Delete this?') → true / false. Red button when the action is destructive.
    A second identical ask while the first is open returns the SAME answer —
    so a double-tap on "Send to all" can't queue two dialogs and send twice.
    nullOnDismiss: Esc / tapping outside gives null instead of false, for
    two-choice questions where "Cancel" is itself a choice. */
export function ask(text: string, opts: { danger?: boolean; okText?: string; cancelText?: string; nullOnDismiss?: boolean } = {}): Promise<any> {
  const existing = pendingAsk.get(text);
  if (existing) return existing.then(() => null); // the duplicate counts as 'closed' (falsy), never as a choice
  const p = new Promise<any>(resolve => {
    asks = [...asks, {
      id: ++seq, text, danger: opts.danger ?? DANGER_WORDS.test(text),
      okText: opts.okText || 'Confirm', cancelText: opts.cancelText || 'Cancel',
      dismissNull: !!opts.nullOnDismiss, resolve,
    }];
    emit();
  }).finally(() => pendingAsk.delete(text));
  pendingAsk.set(text, p);
  return p;
}

/** await askText('How many days?', '5') → string, or null if cancelled. */
export function askText(text: string, initial = ''): Promise<string | null> {
  // Same de-dupe as ask(): a double-click can't queue the question twice.
  const existing = pendingAsk.get('text:' + text);
  if (existing) return existing.then(() => null);
  const p = new Promise<string | null>(resolve => {
    asks = [...asks, {
      id: ++seq, text, danger: false, okText: 'OK', cancelText: 'Cancel',
      input: { value: initial }, resolve,
    }];
    emit();
  }).finally(() => pendingAsk.delete('text:' + text));
  pendingAsk.set('text:' + text, p);
  return p;
}

function settle(a: Ask, v: any) { asks = asks.filter(x => x.id !== a.id); emit(); a.resolve(v); }

function AskDialog({ a }: { a: Ask }) {
  const [val, setVal] = useState(a.input?.value ?? '');
  const okRef = useRef<HTMLButtonElement>(null);
  const inRef = useRef<HTMLInputElement>(null);
  const done = (ok: boolean, dismissed = false) =>
    settle(a, a.input ? (ok ? val : null) : (dismissed && a.dismissNull ? null : ok));
  useEffect(() => {
    (a.input ? inRef.current : okRef.current)?.focus();
    inRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false, true); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return (
    <div className="ask-scrim" onClick={() => done(false, true)}>
      <div className="ask" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="ask-t">{a.text}</div>
        {a.input && (
          <input ref={inRef} value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') done(true); }} />
        )}
        <div className="ask-f">
          <button className="btn ghost" onClick={() => done(false)}>{a.cancelText}</button>
          <button ref={okRef} className={'btn ' + (a.danger ? 'danger' : '')} onClick={() => done(true)}>{a.okText}</button>
        </div>
      </div>
    </div>
  );
}

const ICON = { ok: CheckCircle2, danger: AlertTriangle, info: Info };

export function FeedbackHost() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(n => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  const top = asks[0];
  return (
    <>
      <div className="toasts" aria-live="polite">
        {toasts.map(t => {
          const I = ICON[t.tone];
          return (
            <div key={t.id} className={'toast t-' + t.tone}>
              <I size={16} />
              <span>{t.text}</span>
              <button aria-label="Dismiss" onClick={() => { toasts = toasts.filter(x => x.id !== t.id); emit(); }}><X size={14} /></button>
            </div>
          );
        })}
      </div>
      {top && <AskDialog key={top.id} a={top} />}
    </>
  );
}
