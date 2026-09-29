// New player: name (optional), age (number buttons, each spoken), experience (three picture
// cards), then build the Pawn Buddy. Pip narrates every step.
import { useEffect, useRef, useState } from 'react';
import type { AgeBand } from '../activities/types';
import { bandOfAge } from '../curriculum/tuning';
import { AVATAR_COLORS, FACES, FUN_NAMES, HATS, type AvatarColor, type FaceId } from '../curriculum/wardrobe';
import { MAX_KIDS, cleanName, clipName, getKids, newKid, updateKids, type KidProfile } from '../store/kidsStore';
import { Pip } from '../ui/Pip';
import { PawnBuddy } from '../ui/PawnBuddy';
import { SpeechBubble } from '../ui/SpeechBubble';
import { BigButton } from '../ui/BigButton';
import { KidsIcon } from '../ui/KidsIcon';
import { speech } from '../player/speech';
import { noteInput } from '../player/useSession';
import { markOpened } from '../lib/unlockSeen';
import { go } from '../routes';

/** Ages said as words (each has a recording). */
const AGE_WORDS: Record<number, string> = { 4: 'Four!', 5: 'Five!', 6: 'Six!', 7: 'Seven!', 8: 'Eight!', 9: 'Nine!', 10: 'Ten!', 11: 'Eleven!', 12: 'Twelve!' };

const LINES = [
  "What's your name? A grown-up can type it, or pick a fun name!",
  'How old are you?',
  'Have you played chess before?',
  "Let's build your Pawn Buddy!",
];

/** A fun name no other player here has (any one when they are all taken). */
function funName(): string {
  const taken = new Set(getKids().kids.map((k) => k.name));
  const free = FUN_NAMES.filter((n) => !taken.has(n));
  const pool = free.length ? free : FUN_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function NewKid() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [start, setStart] = useState<KidProfile['start'] | null>(null);
  const [color, setColor] = useState<AvatarColor>('sun');
  const [face, setFace] = useState<FaceId>('smile');
  const [token, setToken] = useState<number | undefined>();
  // Which way the last step change went (0 until the first one), so the step slides in from that side.
  const [dir, setDir] = useState<-1 | 0 | 1>(0);

  // The picker hides "New player" at the limit; a stale link or a second tab must not walk through four steps to nothing.
  useEffect(() => {
    if (getKids().kids.length >= MAX_KIDS) go.picker(true);
  }, []);

  const band: AgeBand = age ? bandOfAge(age) : 'explorer';
  const talk = (t: string) => setToken(speech.speak([t], { rate: 0.95, pitch: 1.05 }));
  useEffect(() => {
    talk(LINES[step]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // A name left empty becomes a fun one now, so the buddy being built already has it.
  const next = () => {
    if (step === 0 && !cleanName(name)) setName(funName());
    setDir(1);
    setStep((s) => s + 1);
  };
  const back = () => (step === 0 ? go.upToPicker() : (setDir(-1), setStep((s) => s - 1)));
  const canNext = step === 0 ? true : step === 1 ? age != null : step === 2 ? start != null : true;

  // Two quick taps on "Let's play!" must not make two players.
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    if (getKids().kids.length >= MAX_KIDS) return go.upToPicker();
    const kid = newKid({ name: cleanName(name) || funName(), band, start: start ?? 'new', avatar: { color, face, hat: null } });
    updateKids((s) => {
      s.kids.push(kid);
      s.activeKid = kid.id;
    });
    noteInput();
    // What is open on day one is not "new" on the map, so the first unlock the kid earns is celebrated.
    markOpened(kid.id, ['w1', 'w1-hello']);
    speech.cancel();
    if (kid.start === 'new') go.play('w1-hello', true);
    else go.placement(undefined, true);
  };

  return (
    <div className={`k-screen k-newkid band-${band}`}>
      <header className="k-screenbar">
        <button type="button" className="k-round k-round-plain" aria-label="Back" onClick={back}>
          <KidsIcon name="back" size={28} />
        </button>
        <div className="k-steps" role="img" aria-label={`Step ${step + 1} of 4`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`k-step-dot${i === step ? ' on' : i < step ? ' done' : ''}`} />
          ))}
        </div>
        <span className="k-round-spacer" />
      </header>
      <div className="k-newkid-coach">
        <Pip mood={step === 3 ? 'cheer' : 'idle'} size={96} />
        <SpeechBubble text={LINES[step]} token={token} onSpeak={() => talk(LINES[step])} />
      </div>

      <div className={`k-newkid-body${dir ? ' k-stepbody' : ''}`} key={step} style={dir ? { ['--sx' as string]: dir } : undefined}>
        {step === 0 && (
          <div className="k-name-step">
            <label className="k-field">
              <span className="k-field-label">Name (for a grown-up to type)</span>
              <input
                className="k-input"
                value={name}
                placeholder="First name or nickname"
                onChange={(e) => setName(clipName(e.target.value))}
                onKeyDown={(e) => {
                  // Enter moves on (not while an input method is still choosing characters).
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) next();
                }}
                autoComplete="off"
              />
            </label>
            <p className="k-or">or pick a fun name</p>
            <div className="k-chips">
              {FUN_NAMES.map((n) => (
                <button key={n} type="button" className={`k-chipbtn${name === n ? ' on' : ''}`} aria-pressed={name === n} onClick={() => setName(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="k-ages" role="radiogroup" aria-label="Age">
            {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={age === a}
                className={`k-age${age === a ? ' on' : ''}`}
                onClick={() => {
                  setAge(a);
                  speech.speak([AGE_WORDS[a] ?? String(a)]);
                }}
              >
                {a}
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <div className="k-exp">
            {(
              [
                ['new', 'Brand new!', <SeedlingArt key="a" />],
                ['moves', 'I know how the pieces move', <KnightArt key="b" />],
                ['games', 'I play real games', <KingsArt key="c" />],
              ] as const
            ).map(([id, label, art]) => (
              <button
                key={id}
                type="button"
                className={`k-exp-card${start === id ? ' on' : ''}`}
                aria-pressed={start === id}
                onClick={() => {
                  setStart(id);
                  speech.speak([label]);
                }}
              >
                <span className="k-exp-art">{art}</span>
                <span className="k-exp-label">{label}</span>
              </button>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className="k-build">
            <div className="k-build-preview">
              <PawnBuddy color={color} face={face} size={150} className="k-bob" />
              <span className="k-build-name">{cleanName(name) || 'Your buddy'}</span>
            </div>
            <div className="k-build-pickers">
              <p className="k-field-label">Color</p>
              <div className="k-swatches">
                {(Object.keys(AVATAR_COLORS) as AvatarColor[]).map((c) => (
                  <button key={c} type="button" className={`k-swatch${color === c ? ' on' : ''}`} style={{ background: AVATAR_COLORS[c].fill }} aria-label={AVATAR_COLORS[c].label} aria-pressed={color === c} onClick={() => setColor(c)} />
                ))}
              </div>
              <p className="k-field-label">Face</p>
              <div className="k-faces">
                {FACES.map((f) => (
                  <button key={f.id} type="button" className={`k-facebtn${face === f.id ? ' on' : ''}`} aria-label={f.label} aria-pressed={face === f.id} onClick={() => setFace(f.id)}>
                    <PawnBuddy color={color} face={f.id} size={44} />
                  </button>
                ))}
              </div>
              <p className="k-field-label">Hats</p>
              <div className="k-faces">
                {HATS.filter((h) => h.id !== 'crown').map((h) => (
                  <span key={h.id} className="k-facebtn locked" title={h.how} role="img" aria-label={`${h.label}: ${h.how}`}>
                    <KidsIcon name="lock" size={20} />
                    <small>{h.stars} stars</small>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="k-newkid-foot">
        {step < 3 ? (
          <BigButton variant="primary" icon="next" onClick={next} disabled={!canNext} whoosh>
            Next
          </BigButton>
        ) : (
          <BigButton variant="go" icon="play" onClick={finish} whoosh>
            Let&rsquo;s play!
          </BigButton>
        )}
      </footer>
    </div>
  );
}

const INK = '#1f2a44';
function SeedlingArt() {
  return (
    <svg viewBox="0 0 100 100" width="96" height="96" aria-hidden="true">
      <path d="M26 86h48l-6-18H32z" fill="#c98d4f" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 68V44" stroke="#3f8f4f" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 50c-18 0-24-12-22-22 14 0 22 8 22 22zM50 44c2-16 12-22 24-20 0 14-10 20-24 20z" fill="#9ad48f" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
function KnightArt() {
  return (
    <span className="k-exp-knight">
      <span className="pc-wN" aria-hidden="true" />
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M70 30h18v18M20 80V62h18" fill="none" stroke="#9a7fe6" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
function KingsArt() {
  return (
    <span className="k-exp-kings">
      <span className="pc-wK" aria-hidden="true" />
      <span className="pc-bK" aria-hidden="true" />
    </span>
  );
}
