// Grown-ups (behind the parent gate): a report per kid, per-kid settings, actions and device
// settings. Plain, calm and readable. Nothing here is ever spoken.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { navigate } from '../../router';
import type { AgeBand } from '../activities/types';
import { BAND_LABEL, BAND_TUNING, BANDS } from '../curriculum/tuning';
import { SKILLS } from '../curriculum/skills';
import { NODE_BY_ID, WORLDS, WORLD_BY_ID } from '../curriculum/worlds';
import { BUDDIES, type BuddyId } from '../curriculum/buddies';
import { REGISTRY } from '../packs';
import { cleanName, clipName, defaultKidsState, defaultSettings, exportKids, getKids, importedKids, IMPORT_MAX_BYTES, kidsRecovered, parseKidsImport, replaceKids, updateKid, updateKids, useKids, useSaveFailed, type KidProfile, type KidSettings, type KidsImport, type KidsState } from '../store/kidsStore';
import { canDo, canGraduate, currentWorld, minutesLast7, neededHelp, startAtRank, totalStars } from '../store/progress';
import { kidSinceReset } from '../store/syncKids';
import { embedded, syncAvailable, useSync } from '../../sync';
import { APP_ADDRESS } from '../../components/InstallCard';
import { isKidsLocked, setKidsLocked } from '../lock';
import { hashPin, newSalt, pinSupported, clearGatePass, keepGatePass } from '../ui/ParentGate';
import { BREAK_MS, pauseSession, setSessionLimit } from '../player/useSession';
import { PawnBuddy } from '../ui/PawnBuddy';
import { KidsIcon } from '../ui/KidsIcon';
import { DEVICE_VOICE, RECORDED, speech } from '../player/speech';
import { VOICE_PREVIEW, voiceNote, voiceScore } from '../player/voices';
import { VoicePackRow } from './VoicePackRow';
import { toast } from '../../lib/toast';
import { plural } from '../lib/plural';
import { go } from '../routes';

export function Grownups({ kidId }: { kidId?: string }) {
  const s = useKids();
  const saveFailed = useSaveFailed();
  const kid = s.kids.find((k) => k.id === kidId) ?? s.kids.find((k) => k.id === s.activeKid) ?? s.kids[0];
  useEffect(() => speech.cancel(), []);
  // A grown-up's time here is not the kid's play time.
  useEffect(() => pauseSession(), []);
  // Taps here keep the gate pass fresh (see keepGatePass), so it does not run out in the middle of an edit.
  useEffect(() => {
    const keep = () => keepGatePass();
    window.addEventListener('pointerdown', keep, true);
    window.addEventListener('keydown', keep, true);
    return () => {
      window.removeEventListener('pointerdown', keep, true);
      window.removeEventListener('keydown', keep, true);
    };
  }, []);
  return (
    <div className="k-screen k-grownups">
      <header className="k-gu-head">
        <button type="button" className="k-round k-round-plain" aria-label="Back" onClick={() => go.back(getKids().activeKid ? 'map' : '')}>
          <KidsIcon name="back" size={26} />
        </button>
        <h1>Grown-ups</h1>
        <button type="button" className="k-gu-link" onClick={() => go.upToPicker()}>
          Kids&rsquo; screen
        </button>
      </header>
      {saveFailed && <p className="k-gu-warn">Progress won&rsquo;t be saved on this device (its storage is full or blocked).</p>}
      {kidsRecovered() && <p className="k-gu-warn">Saved Kids data could not be read, so Kids mode started fresh. A copy of the old data was kept on this device (tempo.kids.v1.bak).</p>}
      {s.kids.length > 0 && (
        <nav className="k-gu-kids" aria-label="Choose a kid">
          {s.kids.map((k) => (
            <button key={k.id} type="button" className={`k-gu-kid${k.id === kid?.id ? ' on' : ''}`} onClick={() => go.grownups(k.id, true)}>
              <PawnBuddy color={k.avatar.color} face={k.avatar.face} hat={k.avatar.hat} size={32} />
              {k.name || 'Player'}
            </button>
          ))}
        </nav>
      )}
      {kid ? (
        <div className="k-gu-cols">
          <Report kid={kid} />
          <KidSettingsPanel kid={kid} />
          <Actions key={kid.id} kid={kid} />
        </div>
      ) : (
        <p className="k-gu-note">No players yet. Add one from the kids&rsquo; screen.</p>
      )}
      <Device />
    </div>
  );
}

function Section({ title, children, icon }: { title: string; children: ReactNode; icon: Parameters<typeof KidsIcon>[0]['name'] }) {
  return (
    <section className="k-gu-card">
      <h2>
        <KidsIcon name={icon} size={20} /> {title}
      </h2>
      {children}
    </section>
  );
}

function Report({ kid }: { kid: KidProfile }) {
  const skills = canDo(kid, REGISTRY);
  const help = neededHelp(kid);
  const mins = minutesLast7(kid);
  const maxMin = Math.max(10, ...mins.map((m) => m.minutes));
  const w = WORLD_BY_ID.get(currentWorld(kid, REGISTRY))!;
  const beaten = (Object.keys(kid.bots) as BuddyId[]).filter((b) => (kid.bots[b]?.w ?? 0) > 0);
  const eases = Object.entries(kid.nodes).filter(([, np]) => np.ease > 0);
  return (
    <Section title={`Report: ${kid.name || 'Player'}`} icon="chart">
      <dl className="k-gu-stats">
        <div>
          <dt>Stars</dt>
          <dd>{totalStars(kid)}</dd>
        </div>
        <div>
          <dt>Current rank</dt>
          <dd>
            {w.rank}: {w.title}
          </dd>
        </div>
        <div>
          <dt>Buddies beaten</dt>
          <dd>{beaten.length ? beaten.map((b) => BUDDIES[b].name).join(', ') : 'None yet'}</dd>
        </div>
        <div>
          <dt>Easier buddies used</dt>
          <dd>{eases.length ? eases.map(([id, np]) => `${NODE_BY_ID.get(id)?.title ?? id} (${np.ease})`).join(', ') : 'None'}</dd>
        </div>
      </dl>
      <h3>Can do</h3>
      <ul className="k-gu-cando">
        {skills.map(({ skill, level }) => (
          <li key={skill} className={level}>
            <span className="k-gu-mark" role="img" aria-label={level === 'full' ? 'Yes' : level === 'half' ? 'Getting there' : 'Not yet'}>
              {level === 'full' ? '✔' : level === 'half' ? '◐' : '○'}
            </span>
            {SKILLS[skill]}
          </li>
        ))}
      </ul>
      <h3>Needed help with</h3>
      <p>{help.length ? help.map((n) => n.title).join(', ') : 'Nothing right now.'}</p>
      <h3>Minutes per day (last 7 days)</h3>
      <div className="k-gu-bars" role="img" aria-label={mins.map((m) => `${m.day}: ${plural(m.minutes, 'minute')}`).join(', ')}>
        {mins.map((m) => (
          <div key={m.day} className="k-gu-bar">
            <span style={{ height: `${(m.minutes / maxMin) * 100}%` }} />
            <small>{new Date(m.day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</small>
          </div>
        ))}
      </div>
      <p className="k-gu-fine">
        Today {mins[mins.length - 1].minutes} min, last 7 days {mins.reduce((t, m) => t + m.minutes, 0)} min.
      </p>
      <h3>Coaching tip</h3>
      <p>{w.tip}</p>
      {kid.graduated || canGraduate(kid, REGISTRY) ? <p className="k-gu-note">Ready for the main Tempo app: Learn and Puzzles.</p> : null}
    </Section>
  );
}

/** Arrow keys move through a radio group and pick, as a group of radio buttons does. */
function arrowRadios(e: KeyboardEvent<HTMLElement>) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step) return;
  const radios = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  const at = radios.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  const next = radios[(at + step + radios.length) % radios.length];
  next.focus();
  next.click();
}

function Seg<T extends string | number>({ label, note, value, options, onChange }: { label: string; note?: string; value: T; options: [T, string][]; onChange(v: T): void }) {
  return (
    <div className="k-gu-row">
      <span className="k-gu-label">
        {label}
        {note && <small>{note}</small>}
      </span>
      <div className="k-gu-seg" role="radiogroup" aria-label={label} onKeyDown={arrowRadios}>
        {options.map(([v, l]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange, disabled, note }: { label: string; value: boolean; onChange(v: boolean): void; disabled?: boolean; note?: string }) {
  return (
    <label className={`k-gu-row k-gu-toggle${disabled ? ' disabled' : ''}`}>
      <span className="k-gu-label">
        {label}
        {note && <small>{note}</small>}
      </span>
      <input type="checkbox" role="switch" checked={value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** The kid's name: typed here, since nothing else can fix a typo made when the player was made. */
function NameRow({ kid }: { kid: KidProfile }) {
  const [draft, setDraft] = useState(kid.name);
  useEffect(() => setDraft(kid.name), [kid.name]);
  const clean = cleanName(draft);
  const twin = useKids().kids.some((k) => k.id !== kid.id && k.name.toLowerCase() === clean.toLowerCase());
  const save = () => {
    if (!clean) setDraft(kid.name);
    else {
      if (clean !== kid.name) updateKid(kid.id, (d) => void (d.name = clean));
      setDraft(clean);
    }
  };
  return (
    <form
      className="k-gu-row"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="k-gu-label" htmlFor="k-gu-name">
        Name
        <small>{twin && clean ? 'Another player has this name too.' : 'Up to 12 characters, shown on the Who’s playing screen.'}</small>
      </label>
      <div className="k-gu-inline">
        <input id="k-gu-name" className="k-gu-text" value={draft} onChange={(e) => setDraft(clipName(e.target.value))} onBlur={save} autoComplete="off" />
        <button type="submit" className="k-gu-btn" disabled={!clean || clean === kid.name}>
          Save
        </button>
      </div>
    </form>
  );
}

function KidSettingsPanel({ kid }: { kid: KidProfile }) {
  const st = kid.settings;
  const set = <K extends keyof KidSettings>(k: K, v: KidSettings[K]) => updateKid(kid.id, (d) => void (d.settings[k] = v));
  const [voices, setVoices] = useState(speech.voices());
  useEffect(() => {
    const t = setTimeout(() => setVoices(speech.voices()), 600);
    return () => clearTimeout(t);
  }, []);
  const device = useKids().device;
  const [pipVoices, setPipVoices] = useState(speech.pipVoices());
  const [listLoaded, setListLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    void speech.loadPipVoices().then(() => {
      if (!live) return;
      setPipVoices(speech.pipVoices());
      setListLoaded(true);
    });
    return () => void (live = false);
  }, []);
  // Without recorded voices (the single-file copy, or a list that did not load), Pip reads with the device's voice.
  const noRecorded = listLoaded && !pipVoices.length;
  const pipVoice = noRecorded ? DEVICE_VOICE : st.pipVoice || speech.defaultPipVoice();
  const preview = () => speech.speak([VOICE_PREVIEW], { rate: st.rate ?? BAND_TUNING[kid.band].speechRate, clipRate: st.rate ?? undefined });
  const pickVoice = (id: string) => {
    set('pipVoice', id);
    speech.setPipVoice(id);
    preview();
  };
  // The picked voice may be another kid's: leaving gives Pip the active kid's voice back.
  useEffect(
    () => () => {
      const all = getKids();
      speech.setPipVoice(all.kids.find((k) => k.id === all.activeKid)?.settings.pipVoice);
    },
    [],
  );
  // A new age group then offers that age's settings, asked here: a browser dialog is blocked
  // inside the claude.ai viewer.
  const [offerReset, setOfferReset] = useState<{ kid: string; band: AgeBand } | null>(null);
  const changeBand = (b: AgeBand) => {
    if (b === kid.band) return;
    updateKid(kid.id, (d) => void (d.band = b));
    setOfferReset({ kid: kid.id, band: b });
  };
  const resetToBand = () => {
    updateKid(kid.id, (d) => void (d.settings = { ...defaultSettings(d.band), unlockAll: d.settings.unlockAll }));
    setOfferReset(null);
    toast({ title: `${kid.name}'s settings were reset.` }, 2500);
  };
  return (
    <Section title="Settings" icon="gear">
      <NameRow key={kid.id} kid={kid} />
      <Seg<AgeBand> label="Age group" value={kid.band} options={BANDS.map((b) => [b, BAND_LABEL[b]])} onChange={changeBand} />
      {offerReset?.kid === kid.id && offerReset.band === kid.band && (
        <div className="k-gu-row">
          <span className="k-gu-label">
            Reset {kid.name}&rsquo;s settings too?
            <small>To the defaults for {BAND_LABEL[kid.band]}. Progress stays.</small>
          </span>
          <div className="k-gu-inline">
            <button type="button" className="k-gu-btn danger" onClick={resetToBand}>
              Yes, reset settings
            </button>
            <button type="button" className="k-gu-btn" onClick={() => setOfferReset(null)}>
              Keep settings
            </button>
          </div>
        </div>
      )}
      <Seg label="Read aloud" value={st.voice} options={[['auto', 'Every line'], ['first', 'New ideas'], ['off', 'Speaker button only']]} onChange={(v) => set('voice', v)} />
      {speech.supported() && (
        <div className="k-gu-row k-gu-voice-row">
          <span className="k-gu-label">
            Pip&apos;s voice <small>Tap a voice to hear it</small>
          </span>
          <div className="k-gu-voices" role="radiogroup" aria-label="Pip's voice" onKeyDown={arrowRadios}>
            {pipVoices.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={pipVoice === v.id} className={`k-gu-voice${pipVoice === v.id ? ' on' : ''}`} onClick={() => pickVoice(v.id)}>
                <strong>{v.name}</strong>
                <small>{v.blurb}</small>
              </button>
            ))}
            <button type="button" role="radio" aria-checked={pipVoice === DEVICE_VOICE} className={`k-gu-voice${pipVoice === DEVICE_VOICE ? ' on' : ''}`} onClick={() => pickVoice(DEVICE_VOICE)}>
              <strong>This device</strong>
              <small>The device&apos;s own voice</small>
            </button>
          </div>
        </div>
      )}
      {speech.supported() && <VoicePackRow voices={pipVoices} selected={pipVoice} />}
      {speech.supported() && noRecorded && (
        <p className="k-gu-note">
          {RECORDED ? (
            "Pip's recorded voices could not be loaded right now, so Pip reads with this device's voice."
          ) : (
            <>
              Pip&rsquo;s recorded voices come with the full app at <strong className="k-gu-address">{APP_ADDRESS}</strong>. Here Pip reads with this device&rsquo;s voice.
            </>
          )}
        </p>
      )}
      {speech.supported() && pipVoice === DEVICE_VOICE && (
        <div className="k-gu-row">
          <span className="k-gu-label">Device voice</span>
          <div className="k-gu-inline">
            <select
              value={device.voiceURI ?? ''}
              onChange={(e) => {
                const v = e.target.value || undefined;
                updateKids((d) => void (d.device.voiceURI = v));
                speech.setVoice(v);
              }}
            >
              <option value="">{`Automatic: most natural${speech.current() ? ` (${speech.current()!.name})` : ''}`}</option>
              {voices.map((v) => {
                const note = voiceNote(v);
                return (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name}
                    {note ? ` (${note})` : ''}
                  </option>
                );
              })}
            </select>
            <button type="button" className="k-gu-btn" onClick={preview}>
              Preview
            </button>
          </div>
        </div>
      )}
      {speech.supported() && pipVoice === DEVICE_VOICE && voices.length > 0 && !voices.some((v) => voiceScore(v) >= 80) && (
        <p className="k-gu-note">
          This device has no natural-sounding voice yet. For a much better one: on a Mac, iPhone or iPad, go to Settings, Accessibility, Spoken Content (Read &amp; Speak on a Mac), Voices, English, and download a Premium or Enhanced voice such as Ava or Zoe. On
          Windows, open Tempo in Microsoft Edge (its Natural voices are built in). On Android, install Google Speech Services voices.
        </p>
      )}
      <div className="k-gu-row">
        <span className="k-gu-label">
          Speech speed
          <small>{st.rate == null ? `Automatic for ${BAND_LABEL[kid.band]}` : `${st.rate.toFixed(2)}x`}</small>
        </span>
        <div className="k-gu-inline">
          <input className="k-gu-range" type="range" min={0.7} max={1.2} step={0.05} value={st.rate ?? BAND_TUNING[kid.band].speechRate} onChange={(e) => set('rate', Number(e.target.value))} aria-label="Speech speed" />
          {st.rate != null && (
            <button type="button" className="k-gu-btn" onClick={() => set('rate', null)}>
              Automatic
            </button>
          )}
        </div>
      </div>
      <Toggle
        label="Sounds"
        value={st.sound && !st.muted}
        onChange={(v) =>
          updateKid(kid.id, (d) => {
            d.settings.sound = v;
            // Turning sounds on also ends the map's quiet mode, so the switch does what it says.
            if (v) d.settings.muted = false;
          })
        }
        note={st.muted ? 'Quiet mode is on (the speaker button on the map)' : 'Also mutes piece sounds'}
      />
      <Seg label="Bedtime colors" value={st.bedtime} options={[['off', 'Off'], ['on', 'On'], ['system', 'Follow device']]} onChange={(v) => set('bedtime', v)} />
      <Seg label="Reduced motion" value={st.reducedMotion} options={[['system', 'Follow device'], ['on', 'On']]} onChange={(v) => set('reducedMotion', v)} />
      <Seg label="Session limit (minutes)" note={`When it is up, Pip rests after the game and the break lasts ${BREAK_MS / 60_000} minutes.`} value={st.sessionMin} options={[[0, 'Off'], [10, '10'], [15, '15'], [20, '20'], [30, '30'], [45, '45']]} onChange={(v) => setSessionLimit(kid.id, v)} />
      <Seg label="Take-backs in games" value={st.takebacks} options={[['always', 'Always'], ['three', '3'], ['one', '1'], ['off', 'Off']]} onChange={(v) => set('takebacks', v)} />
      <Toggle label="Danger Alarm" value={kid.band === 'sprout' || st.dangerAlarm} disabled={kid.band === 'sprout'} onChange={(v) => set('dangerAlarm', v)} note={kid.band === 'sprout' ? 'Always on for ages 4-6' : undefined} />
      {kid.band === 'champion' && <Toggle label="Oops shield (uses the engine)" value={st.oopsShield} onChange={(v) => set('oopsShield', v)} />}
      <Toggle label="Threat lights" value={st.threatLights} onChange={(v) => set('threatLights', v)} />
      <Toggle label="Board coordinates" value={st.coordinates} onChange={(v) => set('coordinates', v)} />
      <Seg label="Hints" value={st.hints} options={[['generous', 'Generous'], ['normal', 'Normal'], ['few', 'Few']]} onChange={(v) => set('hints', v)} />
      <Seg label="Move dots" value={st.showDests} options={[['always', 'Always'], ['until-mastered', 'Until mastered'], ['on-mistake', 'After a mistake']]} onChange={(v) => set('showDests', v)} />
      <Seg label="Pieces" value={st.pieceSet} options={[['auto', 'Automatic'], ['staunton3d', '3D'], ['cburnett', 'Classic']]} onChange={(v) => set('pieceSet', v)} />
      <Toggle label="Tap only (no dragging)" value={st.tapOnly} onChange={(v) => set('tapOnly', v)} />
      <Toggle label="Left-handed layout" value={st.leftHanded} onChange={(v) => set('leftHanded', v)} />
    </Section>
  );
}

/** A press-and-hold button for actions that cannot be undone: the pointer, or Enter or Space, held for `ms`. */
function HoldButton({ label, onDone, ms = 1500 }: { label: string; onDone(): void; ms?: number }) {
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    setOn(false);
    if (t.current) clearTimeout(t.current);
    t.current = null;
  };
  const start = () => {
    if (t.current) return;
    setOn(true);
    t.current = setTimeout(() => {
      t.current = null;
      setOn(false);
      onDone();
    }, ms);
  };
  // A finger that turns into a scroll (pointercancel), a blur or leaving the screen never finishes the action.
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      className={`k-gu-btn danger k-gu-hold${on ? ' on' : ''}`}
      style={{ ['--ms' as string]: `${ms}ms` }}
      title="Press and hold"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={stop}
      onBlur={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span>{label}</span>
    </button>
  );
}

function Actions({ kid }: { kid: KidProfile }) {
  const [startWorld, setStartWorld] = useState(kid.startAt?.rank ?? 1);
  const linked = syncAvailable && !!useSync().code;
  return (
    <Section title="Actions" icon="flag">
      <div className="k-gu-row">
        <span className="k-gu-label">Starting rank</span>
        <div className="k-gu-inline">
          <select value={startWorld} onChange={(e) => setStartWorld(Number(e.target.value))} aria-label="Starting rank">
            {WORLDS.map((w) => (
              <option key={w.id} value={w.rank}>
                Rank {w.rank}: {w.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="k-gu-btn"
            onClick={() => {
              updateKid(kid.id, (d) => startAtRank(d, startWorld));
              toast({ title: `${kid.name} now starts at Rank ${startWorld}.` }, 2500);
            }}
          >
            Set
          </button>
        </div>
      </div>
      <Toggle label="Unlock all ranks" value={kid.settings.unlockAll} onChange={(v) => updateKid(kid.id, (d) => void (d.settings.unlockAll = v))} />
      <div className="k-gu-actions">
        <button type="button" className="k-gu-btn" disabled={!kid.graduated} onClick={() => go.certificate(kid.id)}>
          <KidsIcon name="print" size={18} /> Print certificate
        </button>
        <HoldButton
          label="Hold to reset progress"
          onDone={() => {
            // Clears progress, puzzle rating and test-outs; keeps settings, placement and the session
            // limit. The reset time syncs, so linked devices drop older progress too.
            updateKids((s) => void (s.kids = s.kids.map((k) => (k.id === kid.id ? kidSinceReset(k, Date.now()) : k))));
            toast({ title: `${kid.name}'s progress was reset.` }, 2500);
          }}
        />
        <HoldButton
          label="Hold to delete this player"
          onDone={() => {
            updateKids((s) => {
              s.kids = s.kids.filter((k) => k.id !== kid.id);
              s.removed = { ...s.removed, [kid.id]: Date.now() };
              if (s.activeKid === kid.id) s.activeKid = null;
            });
            toast({ title: 'Player deleted.' }, 2500);
            go.grownups(undefined, true);
          }}
        />
      </div>
      <p className="k-gu-fine">Buttons that start with &ldquo;Hold&rdquo; work when you press and hold them. Resetting keeps the name, look and settings; deleting removes the player for good.</p>
      {linked && <p className="k-gu-fine">Sync is on: resetting or deleting a player also applies on your linked devices.</p>}
    </Section>
  );
}

/** "Sam, Kim and Ann" (or "1 player" with no names to show). */
const names = (kids: KidsState['kids']) => {
  const list = kids.map((k) => k.name || 'Player');
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0] ?? 'no players';
};

function Device() {
  const s = useKids();
  const linked = syncAvailable && !!useSync().code;
  const [pin, setPin] = useState('');
  const [locked, setLocked] = useState(isKidsLocked());
  const file = useRef<HTMLInputElement>(null);
  const [exported, setExported] = useState<string | null>(null);
  const exportBox = useRef<HTMLTextAreaElement>(null);
  // A file read and waiting for a yes, when it would replace players that are on this device.
  const [pending, setPending] = useState<Extract<KidsImport, { ok: true }> | null>(null);
  const exportData = () => {
    const text = exportKids(getKids());
    // Downloads are blocked in the single-file and embedded copies: the data is shown to copy instead.
    if (embedded) return setExported(text);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tempo-kids.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exported ?? '');
      toast({ title: 'Kids data copied.' }, 2500);
    } catch {
      exportBox.current?.select();
      toast({ title: 'Copy blocked: copy the selected text by hand.', tone: 'bad' }, 3000);
    }
  };
  const applyImport = (imp: Extract<KidsImport, { ok: true }>) => {
    replaceKids(importedKids(getKids(), imp.state));
    const n = imp.state.kids.length;
    toast({ title: `Imported ${n} ${n === 1 ? 'player' : 'players'}.${imp.skipped ? ` ${imp.skipped} did not fit.` : ''}` }, 3000);
    setPending(null);
  };
  const importData = async (f: File) => {
    setPending(null);
    const imp: KidsImport = f.size > IMPORT_MAX_BYTES ? { ok: false, reason: 'big' } : parseKidsImport(await f.text().catch(() => ''));
    if (!imp.ok) {
      const why = { big: 'That file is too big to be Kids data.', json: 'That file could not be read as Kids data.', newer: 'That file is from a newer Tempo. Update Tempo, then try again.', notKids: 'That file is not Kids data from Tempo.', empty: 'That file has no players in it.' }[imp.reason];
      toast({ title: why, tone: 'bad' }, 3500);
    } else if (getKids().kids.length) setPending(imp);
    else applyImport(imp);
  };
  return (
    <section className="k-gu-card k-gu-device">
      <h2>
        <KidsIcon name="lock" size={20} /> This device
      </h2>
      {pinSupported() ? (
        <form
          className="k-gu-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pin.length !== 4) return;
            const salt = newSalt();
            const hash = await hashPin(salt, pin);
            updateKids((d) => void (d.device = { ...d.device, pinSalt: salt, pinHash: hash }));
            setPin('');
            toast({ title: s.device.pinHash ? 'PIN changed.' : 'PIN saved.' }, 2000);
          }}
        >
          <label className="k-gu-label" htmlFor="k-gu-pin">
            Grown-up PIN
            <small>{s.device.pinHash ? 'A PIN is set: the gate asks for it instead of a sum. Type 4 digits to change it.' : 'Optional. Replaces the times question.'}</small>
          </label>
          <div className="k-gu-inline">
            <input id="k-gu-pin" className="k-gu-pin" inputMode="numeric" maxLength={4} value={pin} placeholder="4 digits" onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} autoComplete="off" />
            <button type="submit" className="k-gu-btn" disabled={pin.length !== 4}>
              {s.device.pinHash ? 'Change PIN' : 'Set PIN'}
            </button>
            {s.device.pinHash && (
              <button
                type="button"
                className="k-gu-btn"
                onClick={() => {
                  updateKids((d) => void (delete d.device.pinHash, delete d.device.pinSalt));
                  toast({ title: 'PIN cleared.' }, 2000);
                }}
              >
                Clear PIN
              </button>
            )}
          </div>
        </form>
      ) : (
        <p className="k-gu-note">A PIN needs a secure (https) page. The times question is used instead.</p>
      )}
      <Toggle
        label="Lock Kids mode on this device"
        note="The app opens straight into Kids mode. Turn this off to use the rest of Tempo."
        value={locked}
        onChange={(v) => {
          setKidsLocked(v);
          setLocked(v);
        }}
      />
      <div className="k-gu-actions">
        <button type="button" className="k-gu-btn" onClick={exportData}>
          <KidsIcon name="download" size={18} /> Export kids data
        </button>
        <button type="button" className="k-gu-btn" onClick={() => file.current?.click()}>
          <KidsIcon name="upload" size={18} /> Import kids data
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ''; // so choosing the same file again still asks
            if (f) void importData(f);
          }}
        />
        <HoldButton
          label="Hold to delete all kids data"
          onDone={() => {
            const now = Date.now();
            const prev = getKids();
            const removed = { ...prev.removed, ...Object.fromEntries(prev.kids.map((k) => [k.id, now])) };
            // The grown-up PIN and the device voice stay: they are this device's, not a kid's.
            replaceKids({ ...defaultKidsState(), device: prev.device, removed, family: { stars: 0, parties: 0, resetAt: now } });
            toast({ title: 'All kids data deleted.' }, 2500);
            go.upToPicker();
          }}
        />
        <button
          type="button"
          className="k-gu-btn"
          onClick={() => {
            if (isKidsLocked()) {
              toast({ title: 'Turn off "Lock Kids mode" first.' }, 2500);
              return;
            }
            clearGatePass();
            speech.cancel();
            navigate('home');
          }}
        >
          <KidsIcon name="door" size={18} /> Exit to Tempo
        </button>
      </div>
      {pending && (
        <div className="k-gu-export" role="alertdialog" aria-label="Replace the players on this device?">
          <p className="k-gu-label">
            Replace the players on this device?
            <small>
              This device has {names(s.kids)}. The file has {names(pending.state.kids)}. Importing replaces them, and their progress here is lost
              {linked ? ' (on your linked devices too)' : ''}.{pending.skipped ? ` ${pending.skipped} in the file did not fit.` : ''}
            </small>
          </p>
          <div className="k-gu-inline">
            <button type="button" className="k-gu-btn danger" onClick={() => applyImport(pending)}>
              Yes, replace them
            </button>
            <button type="button" className="k-gu-btn" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {exported !== null && (
        <div className="k-gu-export">
          <label htmlFor="k-gu-export" className="k-gu-label">
            Kids data
            <small>Copy it and save it as a .json file to bring it into another copy of Tempo with Import kids data.</small>
          </label>
          <textarea id="k-gu-export" ref={exportBox} readOnly rows={6} spellCheck={false} value={exported} />
          <div className="k-gu-inline">
            <button type="button" className="k-gu-btn" onClick={() => void copyExport()}>
              Copy
            </button>
            <button type="button" className="k-gu-btn" onClick={() => setExported(null)}>
              Close
            </button>
          </div>
        </div>
      )}
      <p className="k-gu-fine">
        {linked
          ? "Kids' names, settings and progress are shared with your linked devices through your sync code. The PIN and the Kids-mode lock stay on this device."
          : syncAvailable
            ? "Kids data stays on this device unless you turn on sync in Tempo's Settings; then kids' names, settings and progress are shared with your linked devices."
            : 'Kids data stays on this device. It is never synced or sent anywhere.'}{' '}
        The gate is a speed bump for little hands, not a lock.
      </p>
    </section>
  );
}

