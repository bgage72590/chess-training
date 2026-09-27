// Grown-ups (behind the parent gate): a report per kid, per-kid settings, actions and device
// settings. Plain, calm and readable. Nothing here is ever spoken.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { navigate } from '../../router';
import type { AgeBand } from '../activities/types';
import { BAND_LABEL, BANDS } from '../curriculum/tuning';
import { SKILLS } from '../curriculum/skills';
import { WORLDS, WORLD_BY_ID } from '../curriculum/worlds';
import { BUDDIES, type BuddyId } from '../curriculum/buddies';
import { REGISTRY } from '../packs';
import { defaultKidsState, defaultSettings, getKids, normalizeKids, replaceKids, updateKid, updateKids, useKids, useSaveFailed, kidsRecovered, type KidProfile, type KidSettings } from '../store/kidsStore';
import { applyPlacement, canDo, canGraduate, currentWorld, minutesLast7, neededHelp, totalStars } from '../store/progress';
import { isKidsLocked, setKidsLocked } from '../lock';
import { hashPin, newSalt, pinSupported, clearGatePass } from '../ui/ParentGate';
import { PawnBuddy } from '../ui/PawnBuddy';
import { KidsIcon } from '../ui/KidsIcon';
import { speech } from '../player/speech';
import { voiceNote, voiceScore } from '../player/voices';
import { toast } from '../../lib/toast';
import { go } from '../routes';

export function Grownups({ kidId }: { kidId?: string }) {
  const s = useKids();
  const saveFailed = useSaveFailed();
  const kid = s.kids.find((k) => k.id === kidId) ?? s.kids.find((k) => k.id === s.activeKid) ?? s.kids[0];
  useEffect(() => speech.cancel(), []);
  return (
    <div className="k-screen k-grownups">
      <header className="k-gu-head">
        <button type="button" className="k-round k-round-plain" aria-label="Back" onClick={() => (getKids().activeKid ? go.map() : go.picker())}>
          <KidsIcon name="back" size={26} />
        </button>
        <h1>Grown-ups</h1>
        <button type="button" className="k-gu-link" onClick={() => go.picker()}>
          Kids&rsquo; screen
        </button>
      </header>
      {saveFailed && <p className="k-gu-warn">Progress won&rsquo;t be saved on this device (storage is blocked).</p>}
      {kidsRecovered() && <p className="k-gu-warn">Saved Kids data could not be read, so Kids mode started fresh. A copy of the old data was kept on this device (tempo.kids.v1.bak).</p>}
      {s.kids.length > 0 && (
        <nav className="k-gu-kids" aria-label="Choose a kid">
          {s.kids.map((k) => (
            <button key={k.id} type="button" className={`k-gu-kid${k.id === kid?.id ? ' on' : ''}`} onClick={() => go.grownups(k.id)}>
              <PawnBuddy color={k.avatar.color} face={k.avatar.face} hat={k.avatar.hat} size={32} />
              {k.name}
            </button>
          ))}
        </nav>
      )}
      {kid ? (
        <div className="k-gu-cols">
          <Report kid={kid} />
          <KidSettingsPanel kid={kid} />
          <Actions kid={kid} />
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
    <Section title={`Report: ${kid.name}`} icon="chart">
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
          <dd>{eases.length ? eases.map(([id, np]) => `${id} (${np.ease})`).join(', ') : 'None'}</dd>
        </div>
      </dl>
      <h3>Can do</h3>
      <ul className="k-gu-cando">
        {skills.map(({ skill, level }) => (
          <li key={skill} className={level}>
            <span className="k-gu-mark" aria-label={level === 'full' ? 'Yes' : level === 'half' ? 'Getting there' : 'Not yet'}>
              {level === 'full' ? '✔' : level === 'half' ? '◐' : '○'}
            </span>
            {SKILLS[skill]}
          </li>
        ))}
      </ul>
      <h3>Needed help with</h3>
      <p>{help.length ? help.map((n) => n.title).join(', ') : 'Nothing right now.'}</p>
      <h3>Minutes per day (last 7 days)</h3>
      <div className="k-gu-bars" role="img" aria-label={mins.map((m) => `${m.day}: ${m.minutes} minutes`).join(', ')}>
        {mins.map((m) => (
          <div key={m.day} className="k-gu-bar">
            <span style={{ height: `${(m.minutes / maxMin) * 100}%` }} />
            <small>{new Date(m.day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</small>
          </div>
        ))}
      </div>
      <h3>Coaching tip</h3>
      <p>{w.tip}</p>
      {kid.graduated || canGraduate(kid, REGISTRY) ? <p className="k-gu-note">Ready for the main Tempo app: Learn and Puzzles.</p> : null}
    </Section>
  );
}

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange(v: T): void }) {
  return (
    <div className="k-gu-row">
      <span className="k-gu-label">{label}</span>
      <div className="k-gu-seg" role="radiogroup" aria-label={label}>
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

function KidSettingsPanel({ kid }: { kid: KidProfile }) {
  const st = kid.settings;
  const set = <K extends keyof KidSettings>(k: K, v: KidSettings[K]) => updateKid(kid.id, (d) => void (d.settings[k] = v));
  const [voices, setVoices] = useState(speech.voices());
  useEffect(() => {
    const t = setTimeout(() => setVoices(speech.voices()), 600);
    return () => clearTimeout(t);
  }, []);
  const device = useKids().device;
  const changeBand = (b: AgeBand) => {
    if (b === kid.band) return;
    const reset = window.confirm("Reset this kid's settings to the new age defaults?");
    updateKid(kid.id, (d) => {
      d.band = b;
      if (reset) d.settings = { ...defaultSettings(b), unlockAll: d.settings.unlockAll };
    });
  };
  return (
    <Section title="Settings" icon="gear">
      <Seg<AgeBand> label="Age group" value={kid.band} options={BANDS.map((b) => [b, BAND_LABEL[b]])} onChange={changeBand} />
      <Seg label="Read aloud" value={st.voice} options={[['auto', 'Every line'], ['first', 'New ideas'], ['off', 'Speaker button only']]} onChange={(v) => set('voice', v)} />
      {speech.supported() && (
        <div className="k-gu-row">
          <span className="k-gu-label">Voice</span>
          <div className="k-gu-inline">
            <select
              value={device.voiceURI ?? ''}
              onChange={(e) => {
                const v = e.target.value || undefined;
                updateKids((d) => void (d.device.voiceURI = v));
                speech.setVoice(v);
              }}
            >
              <option value="">{speech.recorded() || device.voiceURI ? "Pip's recorded voice (most natural)" : `Automatic: best device voice${speech.current() ? ` (${speech.current()!.name})` : ''}`}</option>
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
            <button type="button" className="k-gu-btn" onClick={() => speech.speak(["Hi! I'm Pip. Let's play chess together!"], { rate: st.rate ?? 1 })}>
              Preview
            </button>
          </div>
        </div>
      )}
      {speech.supported() && device.voiceURI && voices.length > 0 && !voices.some((v) => voiceScore(v) >= 80) && (
        <p className="k-gu-note">
          This device has no natural-sounding voice yet. For a much better one: on a Mac, iPhone or iPad, go to Settings, Accessibility, Spoken Content (Read &amp; Speak on a Mac), Voices, English, and download a Premium or Enhanced voice such as Ava or Zoe. On
          Windows, open Tempo in Microsoft Edge (its Natural voices are built in). On Android, install Google Speech Services voices.
        </p>
      )}
      <div className="k-gu-row">
        <span className="k-gu-label">Speech speed</span>
        <input type="range" min={0.7} max={1.2} step={0.05} value={st.rate ?? 1} onChange={(e) => set('rate', Number(e.target.value))} aria-label="Speech speed" />
      </div>
      <Toggle label="Sounds" value={st.sound} onChange={(v) => set('sound', v)} note="Also mutes piece sounds" />
      <Seg label="Bedtime colors" value={st.bedtime} options={[['off', 'Off'], ['on', 'On'], ['system', 'Follow device']]} onChange={(v) => set('bedtime', v)} />
      <Seg label="Reduced motion" value={st.reducedMotion} options={[['system', 'Follow device'], ['on', 'On']]} onChange={(v) => set('reducedMotion', v)} />
      <Seg label="Session limit" value={st.sessionMin} options={[[0, 'Off'], [10, '10'], [15, '15'], [20, '20'], [30, '30'], [45, '45 min']]} onChange={(v) => set('sessionMin', v)} />
      <Seg label="Take-backs in games" value={st.takebacks} options={[['always', 'Always'], ['three', '3'], ['one', '1'], ['off', 'Off']]} onChange={(v) => set('takebacks', v)} />
      <Toggle label="Danger Alarm" value={st.dangerAlarm} disabled={kid.band === 'sprout'} onChange={(v) => set('dangerAlarm', v)} note={kid.band === 'sprout' ? 'Always on for ages 4-6' : undefined} />
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

function HoldButton({ label, onDone, ms = 1500 }: { label: string; onDone(): void; ms?: number }) {
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    setOn(false);
    if (t.current) clearTimeout(t.current);
  };
  return (
    <button
      type="button"
      className={`k-gu-btn danger k-gu-hold${on ? ' on' : ''}`}
      style={{ ['--ms' as string]: `${ms}ms` }}
      onPointerDown={() => {
        setOn(true);
        t.current = setTimeout(() => {
          setOn(false);
          onDone();
        }, ms);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span>{label}</span>
    </button>
  );
}

function Actions({ kid }: { kid: KidProfile }) {
  const [startWorld, setStartWorld] = useState(1);
  return (
    <Section title="Actions" icon="flag">
      <div className="k-gu-row">
        <span className="k-gu-label">Starting world</span>
        <div className="k-gu-inline">
          <select value={startWorld} onChange={(e) => setStartWorld(Number(e.target.value))} aria-label="Starting world">
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
              updateKid(kid.id, (d) => applyPlacement(d, Array.from({ length: startWorld - 1 }, (_, i) => i + 1)));
              toast({ title: `${kid.name} now starts at Rank ${startWorld}.` }, 2500);
            }}
          >
            Set
          </button>
        </div>
      </div>
      <Toggle label="Unlock all worlds" value={kid.settings.unlockAll} onChange={(v) => updateKid(kid.id, (d) => void (d.settings.unlockAll = v))} />
      <div className="k-gu-actions">
        <button type="button" className="k-gu-btn" disabled={!kid.graduated} onClick={() => go.certificate(kid.id)}>
          <KidsIcon name="print" size={18} /> Print certificate
        </button>
        <HoldButton
          label="Hold to reset progress"
          onDone={() => {
            updateKid(kid.id, (d) => {
              d.nodes = {};
              d.stickers = {};
              d.trophies = {};
              d.wardrobe = [];
              d.garden = 0;
              d.days = {};
              d.bests = {};
              d.bots = {};
              d.graduated = undefined;
              d.avatar.hat = null;
            });
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
            go.grownups();
          }}
        />
      </div>
    </Section>
  );
}

function Device() {
  const s = useKids();
  const [pin, setPin] = useState('');
  const [locked, setLocked] = useState(isKidsLocked());
  const file = useRef<HTMLInputElement>(null);
  const exportData = () => {
    const blob = new Blob([JSON.stringify(getKids(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tempo-kids.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importData = async (f: File) => {
    try {
      const data = normalizeKids(JSON.parse(await f.text()));
      if (!data.kids.length) throw new Error('empty');
      replaceKids(data);
      toast({ title: `Imported ${data.kids.length} ${data.kids.length === 1 ? 'player' : 'players'}.` }, 2500);
    } catch {
      toast({ title: 'That file could not be imported.', tone: 'bad' }, 3000);
    }
  };
  return (
    <section className="k-gu-card k-gu-device">
      <h2>
        <KidsIcon name="lock" size={20} /> This device
      </h2>
      {pinSupported() ? (
        <div className="k-gu-row">
          <span className="k-gu-label">
            Grown-up PIN
            <small>{s.device.pinHash ? 'A PIN is set: the gate asks for it instead of a sum.' : 'Optional. Replaces the times question.'}</small>
          </span>
          <div className="k-gu-inline">
            <input className="k-gu-pin" inputMode="numeric" maxLength={4} value={pin} placeholder="4 digits" onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="New PIN" />
            <button
              type="button"
              className="k-gu-btn"
              disabled={pin.length !== 4}
              onClick={async () => {
                const salt = newSalt();
                const hash = await hashPin(salt, pin);
                updateKids((d) => void (d.device = { ...d.device, pinSalt: salt, pinHash: hash }));
                setPin('');
                toast({ title: 'PIN saved.' }, 2000);
              }}
            >
              Set PIN
            </button>
            {s.device.pinHash && (
              <button type="button" className="k-gu-btn" onClick={() => updateKids((d) => void (delete d.device.pinHash, delete d.device.pinSalt))}>
                Clear PIN
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="k-gu-note">A PIN needs a secure (https) page. The times question is used instead.</p>
      )}
      <Toggle
        label="Lock Kids mode on this device"
        note="The app opens straight into Kids mode."
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
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void importData(e.target.files[0])} />
        <HoldButton
          label="Hold to delete all kids data"
          onDone={() => {
            const now = Date.now();
            const prev = getKids();
            const removed = { ...prev.removed, ...Object.fromEntries(prev.kids.map((k) => [k.id, now])) };
            replaceKids({ ...defaultKidsState(), removed });
            toast({ title: 'All kids data deleted.' }, 2500);
            go.picker();
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
      <p className="k-gu-fine">Kids data stays on this device. It is never synced or sent anywhere. The gate is a speed bump for little hands, not a lock.</p>
    </section>
  );
}

