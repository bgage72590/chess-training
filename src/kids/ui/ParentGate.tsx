// The parent gate: press and hold for 2 s, then a times question in words (or the 4-digit PIN).
// A speed bump, not security. Never spoken: speech is cancelled and muted while it is open.
// A pass lasts 5 minutes, in memory only.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getKids } from '../store/kidsStore';
import { speech } from '../player/speech';
import { Keypad } from './Keypad';
import { KidsIcon } from './KidsIcon';

const PASS_MS = 5 * 60 * 1000;
const HOLD_MS = 2000;

let passUntil = 0;
let request: { reason: string; onPass: () => void; id: number } | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function gatePassed(): boolean {
  return Date.now() < passUntil;
}

/** Runs `onPass` now if a gate pass is fresh, else opens the gate. */
export function requireGate(reason: string, onPass: () => void) {
  if (gatePassed()) {
    onPass();
    return;
  }
  request = { reason, onPass, id: ++seq };
  emit();
}

export function clearGatePass() {
  passUntil = 0;
}

function close() {
  request = null;
  emit();
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

export function newQuestion(rng = Math.random): { text: string; answer: number } {
  const a = 11 + Math.floor(rng() * 9);
  const b = 3 + Math.floor(rng() * 7);
  return { text: `What is ${WORDS[a]} times ${WORDS[b]}?`, answer: a * b };
}

// ---------- Modal ----------

export function GateHost() {
  const req = useRequest();
  if (!req) return null;
  return <ParentGate key={req.id} reason={req.reason} onPass={req.onPass} />;
}

function ParentGate({ reason, onPass }: { reason: string; onPass: () => void }) {
  const [step, setStep] = useState<'hold' | 'ask'>('hold');
  const [holding, setHolding] = useState(false);
  const [q, setQ] = useState(newQuestion);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const device = getKids().device;
  const usePin = !!device.pinHash && !!device.pinSalt && pinSupported();

  useEffect(() => {
    speech.setMuted(true);
    return () => speech.setMuted(false);
  }, []);

  const startHold = () => {
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      setStep('ask');
    }, HOLD_MS);
  };
  const stopHold = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => () => stopHold(), []);

  const pass = () => {
    passUntil = Date.now() + PASS_MS;
    close();
    onPass();
  };

  const submit = async () => {
    if (usePin) {
      const h = await hashPin(device.pinSalt!, value);
      if (h === device.pinHash) return pass();
      setNote('That PIN did not match. Try again.');
      setValue('');
      return;
    }
    if (Number(value) === q.answer) return pass();
    setNote('Not quite. Here is a new question.');
    setQ(newQuestion());
    setValue('');
  };

  return (
    <div className="k-overlay k-gate-wrap" role="dialog" aria-modal="true" aria-label="Grown-ups only">
      <div className="k-card k-gate">
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
              type="button"
              className={`k-hold${holding ? ' on' : ''}`}
              onPointerDown={startHold}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !holding) startHold();
              }}
              onKeyUp={stopHold}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Press and hold for 2 seconds"
            >
              <svg viewBox="0 0 100 100" aria-hidden="true">
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
            <div className="k-gate-value" aria-live="polite">
              {usePin ? '●'.repeat(value.length) || ' ' : value || ' '}
            </div>
            <Keypad value={value} onChange={setValue} onOk={() => void submit()} max={usePin ? 4 : 3} />
            {note && <p className="k-gate-note">{note}</p>}
          </div>
        )}
        <p className="k-gate-fine">This is a speed bump for little hands, not a lock.</p>
      </div>
    </div>
  );
}
