// The parent gate: press and hold for 2 s, then a times question in words (or the 4-digit PIN).
// A speed bump, not security. Never spoken: speech is cancelled and muted while it is open. Five wrong
// answers in a row lock the keypad for 30 seconds; "Forgot the PIN?" swaps it for a harder question.
// A pass is kept (5 minutes since the last tap there, in memory only) just for moving around inside the grown-ups area; KidsApp
// clears it whenever the route leaves that area. One-off actions (exit, add a player, 10 more minutes)
// never keep a pass, so a device handed back to a child always asks again.
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { getKids } from '../store/kidsStore';
import { speech } from '../player/speech';
import { Keypad } from './Keypad';
import { KidsIcon } from './KidsIcon';

const PASS_MS = 5 * 60 * 1000;
const HOLD_MS = 2000;
const MAX_MISSES = 5;
const LOCK_MS = 30_000;

let passUntil = 0;
let request: { reason: string; onPass: () => void; id: number; keep: boolean } | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function gatePassed(): boolean {
  return Date.now() < passUntil;
}

/**
 * Runs `onPass` now if a gate pass is fresh (only inside the grown-ups area), else opens the gate.
 * `keep: true` (entering the grown-ups area or the certificate) keeps a pass after success.
 */
export function requireGate(reason: string, onPass: () => void, opts: { keep?: boolean } = {}) {
  if (gatePassed()) {
    onPass();
    return;
  }
  request = { reason, onPass, id: ++seq, keep: !!opts.keep };
  emit();
}

export function clearGatePass() {
  passUntil = 0;
}

/** Activity in the grown-ups area keeps a fresh pass fresh, so a grown-up who is still busy is not asked
 *  again in the middle of an edit. It never revives a pass that has run out. */
export function keepGatePass(now = Date.now()) {
  if (now < passUntil) passUntil = now + PASS_MS;
}

/** Test hooks: set when the pass runs out, and read how long is left. */
export function __setGatePassForTests(until: number) {
  passUntil = until;
}
export const gatePassLeft = (now = Date.now()) => Math.max(0, passUntil - now);

// ---------- Wrong answers ----------

// Kept while the gate is closed and opened again, so closing it does not reset the count.
let misses = 0;
let lockedUntil = 0;

/** A wrong answer: the fifth in a row locks the keypad for a while. */
export function noteMiss(now = Date.now()) {
  misses++;
  if (misses >= MAX_MISSES) {
    misses = 0;
    lockedUntil = now + LOCK_MS;
  }
}

/** Milliseconds left of the lock (never more than LOCK_MS, so a clock set back cannot lock it for days). */
export const lockLeft = (now = Date.now()) => Math.min(LOCK_MS, Math.max(0, lockedUntil - now));

export function resetMisses() {
  misses = 0;
  lockedUntil = 0;
}

function close() {
  request = null;
  emit();
}

/** Drops an open gate request (the screen that asked has gone: Back, say), so it cannot pass later
 *  and run its action on another screen. */
export function cancelGate() {
  if (request) close();
}

function useRequest() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => request,
    () => request,
  );
}

// ---------- PIN ----------

export const pinSupported = () => typeof crypto !== 'undefined' && !!crypto.subtle && typeof window !== 'undefined' && window.isSecureContext !== false;

export async function hashPin(salt: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(salt + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSalt(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Questions ----------

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const say = (n: number) => (n < 20 ? WORDS[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${WORDS[n % 10]}` : ''));

/** `hard`: for a grown-up who forgot the PIN. Two-digit numbers, so a child cannot do it in their head. */
export function newQuestion(rng = Math.random, hard = false): { text: string; answer: number } {
  let a = hard ? 23 + Math.floor(rng() * 27) : 11 + Math.floor(rng() * 9);
  if (hard && a % 10 === 0) a++;
  const b = hard ? 12 + Math.floor(rng() * 8) : 3 + Math.floor(rng() * 7);
  return { text: `What is ${say(a)} times ${say(b)}?`, answer: a * b };
}

// ---------- Modal ----------

export function GateHost() {
  const req = useRequest();
  if (!req) return null;
  return <ParentGate key={req.id} reason={req.reason} onPass={req.onPass} keep={req.keep} />;
}

function ParentGate({ reason, onPass, keep }: { reason: string; onPass: () => void; keep: boolean }) {
  const [step, setStep] = useState<'hold' | 'ask'>('hold');
  const [holding, setHolding] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [q, setQ] = useState(() => newQuestion());
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [, tick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const holdBtn = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const device = getKids().device;
  const usePin = !!device.pinHash && !!device.pinSalt && pinSupported() && !forgot;
  const max = usePin ? 4 : 3;
  const wait = Math.ceil(lockLeft() / 1000);
  const locked = wait > 0;

  useEffect(() => {
    speech.setMuted(true);
    return () => speech.setMuted(false);
  }, []);

  // Focus goes into the dialog and back to where it was; the keypad step takes it so typing works.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    holdBtn.current?.focus();
    return () => {
      if (prev && document.contains(prev)) prev.focus?.();
    };
  }, []);
  useEffect(() => {
    if (step === 'ask') dialog.current?.focus();
  }, [step, forgot]);

  // Counts the lock down while it lasts.
  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [locked]);

  const startHold = () => {
    if (timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      setStep('ask');
    }, HOLD_MS);
  };
  const stopHold = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => stopHold(), []);

  const pass = () => {
    resetMisses();
    passUntil = keep ? Date.now() + PASS_MS : 0;
    close();
    onPass();
  };

  const submit = async () => {
    if (busy.current || locked || !value) return;
    busy.current = true;
    try {
      const ok = usePin ? (await hashPin(device.pinSalt!, value)) === device.pinHash : Number(value) === q.answer;
      if (ok) return pass();
      noteMiss();
      setValue('');
      if (lockLeft() > 0) setNote('');
      else if (usePin) setNote('That PIN did not match. Try again.');
      else {
        setNote('Not quite. Here is a new question.');
        setQ(newQuestion(Math.random, forgot));
      }
      tick((x) => x + 1);
    } catch {
      setNote('The PIN could not be checked. Try again.');
    } finally {
      busy.current = false;
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      // Tab stays inside the dialog.
      const items = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
      if (!items.length) return e.preventDefault();
      const at = document.activeElement;
      if (e.shiftKey && (at === items[0] || at === dialog.current)) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && at === items[items.length - 1]) {
        e.preventDefault();
        items[0].focus();
      }
      return;
    }
    if (step !== 'ask' || locked || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      setValue((v) => (v.length < max ? v + e.key : v));
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      setValue((v) => v.slice(0, -1));
    } else if (e.key === 'Enter') {
      // Enter on a number key or OK sends the answer; on the other buttons it does what they say.
      const t = e.target as HTMLElement;
      if (t.tagName === 'BUTTON' && (!t.classList.contains('k-key') || t.classList.contains('k-key-soft'))) return;
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="k-overlay k-gate-wrap" role="dialog" aria-modal="true" aria-label="Grown-ups only" onKeyDown={onKeyDown}>
      <div className="k-card k-gate" ref={dialog} tabIndex={-1}>
        <button type="button" className="k-round k-round-plain k-gate-close" aria-label="Close" onClick={close}>
          <KidsIcon name="x" size={26} />
        </button>
        <h2 className="k-gate-title">
          <KidsIcon name="lock" size={28} /> Grown-ups only
        </h2>
        <p className="k-gate-reason">{reason}</p>
        {step === 'hold' ? (
          <div className="k-gate-hold">
            <button
              ref={holdBtn}
              type="button"
              className={`k-hold${holding ? ' on' : ''}`}
              onPointerDown={startHold}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') startHold();
              }}
              onKeyUp={stopHold}
              onBlur={stopHold}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Press and hold for 2 seconds"
            >
              <svg className="k-hold-ring" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="44" className="k-hold-track" />
                <circle cx="50" cy="50" r="44" className="k-hold-fill" />
              </svg>
              <KidsIcon name="lock" size={34} />
            </button>
            <p className="k-gate-help">Grown-ups: press and hold</p>
          </div>
        ) : (
          <div className="k-gate-ask">
            <p className="k-gate-q">{usePin ? 'Enter the grown-up PIN' : q.text}</p>
            <div className="k-gate-value" aria-live={usePin ? 'off' : 'polite'}>
              {usePin ? '●'.repeat(value.length) || ' ' : value || ' '}
            </div>
            <Keypad value={value} onChange={setValue} onOk={() => void submit()} max={max} disabled={locked} />
            <p className="k-gate-note" role="status">
              {locked ? `Too many tries. Please wait ${wait} ${wait === 1 ? 'second' : 'seconds'}.` : note}
            </p>
            {usePin && (
              <button
                type="button"
                className="k-linkbtn k-gate-forgot"
                onClick={() => {
                  setForgot(true);
                  setValue('');
                  setNote('No PIN this time: answer this question instead.');
                  setQ(newQuestion(Math.random, true));
                }}
              >
                Forgot the PIN?
              </button>
            )}
          </div>
        )}
        <p className="k-gate-fine">This is a speed bump for little hands, not a lock.</p>
      </div>
    </div>
  );
}
