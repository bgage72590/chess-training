import { useState, type ReactNode } from 'react';
import './install.css';
import { navigate } from '../router';
import { useInstall, type InstallState } from '../pwa/install';
import type { Profile } from '../store/profile';
import { Button } from './ui';
import { StorageSplitNote } from './StorageSplitNote';

const DISMISS_KEY = 'tempo.installGuide.dismissed';

export function readGuideDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeGuideDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* storage is blocked: the banner comes back next visit, which is better than an error */
  }
}

/** Which guide fits this browser: the Home Screen steps, the Dock steps, or "open it in Safari". */
export type GuideKind = 'ios' | 'mac' | 'in-app';

/** Null where there is nothing to show: already installed, Chrome and Edge (they have a real Install
 *  button), embedded copies, and in-app browsers that are not on an iPhone or iPad. */
export function guideKind({ installed, how, ios }: Pick<InstallState, 'installed' | 'how' | 'ios'>): GuideKind | null {
  if (installed) return null;
  if (how === 'ios') return 'ios';
  if (how === 'safari-mac') return 'mac';
  if (how === 'in-app' && ios) return 'in-app';
  return null;
}

/** The banner waits until there is progress worth keeping, and stays away once hidden. */
export const shouldShowGuide = (kind: GuideKind | null, ready: boolean, dismissed: boolean): boolean => kind !== null && ready && !dismissed;

/** The first finished lesson or puzzle. */
export const hasFinishedFirst = (p: Pick<Profile, 'puzzles' | 'lessons'>): boolean => p.puzzles.solved > 0 || Object.values(p.lessons).some((l) => l.done);

const GLYPHS = {
  share: <path d="M12 3v11M8.5 6.5 12 3l3.5 3.5M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
  addHome: <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM12 8v8M8 12h8" />,
  dock: (
    <>
      <path d="M4 4.5h16v11H4z" />
      <rect x="7" y="18" width="10" height="2.5" rx="1.2" fill="currentColor" />
    </>
  ),
  safari: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z" />,
};

function Glyph({ name }: { name: keyof typeof GLYPHS }) {
  return (
    <svg className="ig-glyph" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[name]}
    </svg>
  );
}

const Pill = ({ children }: { children: ReactNode }) => <span className="ig-pill">{children}</span>;
const ShareOrMore = () => (
  <>
    <Glyph name="share" />
    <span className="ig-or">or</span>
    <Glyph name="more" />
  </>
);

/** What to do, as pictures with a line each; the wording avoids where iOS puts things, which changes. */
function stepsFor(kind: GuideKind): { steps: { pic: ReactNode; text: ReactNode }[]; after: ReactNode } {
  if (kind === 'mac') {
    return {
      steps: [
        { pic: <Pill>File</Pill>, text: <>In Safari&rsquo;s menu bar, open <strong>File</strong>.</> },
        { pic: <Glyph name="dock" />, text: <>Choose <strong>Add to Dock&hellip;</strong></> },
        { pic: <Pill>Add</Pill>, text: <>Click <strong>Add</strong>.</> },
      ],
      after: 'Then open Tempo from the Dock (or Launchpad). This needs macOS 14 Sonoma or later; if File has no Add to Dock, open Tempo in Chrome or Edge to install it.',
    };
  }
  if (kind === 'in-app') {
    return {
      steps: [
        { pic: <ShareOrMore />, text: <>Tap the <strong>&hellip;</strong> or <strong>Share</strong> button in this app.</> },
        { pic: <Glyph name="safari" />, text: <>Choose <strong>Open in Safari</strong> (it may say Open in browser).</> },
      ],
      after: 'Then follow the Add to Home Screen steps in Safari.',
    };
  }
  return {
    steps: [
      { pic: <ShareOrMore />, text: <>Tap <strong>Share</strong> in your browser&rsquo;s toolbar. On newer iOS it may be under the <strong>&hellip;</strong> menu.</> },
      { pic: <Glyph name="addHome" />, text: <>Scroll down and tap <strong>Add to Home Screen</strong>.</> },
      { pic: <Pill>Add</Pill>, text: <>Tap <strong>Add</strong>.</> },
    ],
    after: 'Then open Tempo from the new icon on your Home Screen.',
  };
}

/** The install steps as a picture-style list (Home Screen on iPhone and iPad, Dock on a Mac). */
export function InstallSteps({ kind }: { kind: GuideKind }) {
  const { steps, after } = stepsFor(kind);
  return (
    <>
      <ol className="ig-steps">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="ig-pic" aria-hidden="true">
              {s.pic}
            </span>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
      <p className="ig-after">
        {kind === 'ios' && <img className="ig-appicon" src="./icons/apple-touch-icon.png" alt="" width="36" height="36" />}
        <span>{after}</span>
      </p>
    </>
  );
}

const TITLE: Record<GuideKind, string> = {
  ios: 'Add Tempo to your Home Screen',
  mac: 'Add Tempo to your Dock',
  'in-app': 'Open this page in Safari first',
};

/**
 * A banner, on iPhone, iPad and Mac Safari (which offer no install button), that shows how to install
 * Tempo and warns that the installed app starts with its own, empty progress. It waits for `ready`
 * (the first finished lesson or puzzle) and can be hidden for good. It sits in the page, never over it.
 */
export function InstallGuide({ ready, variant = 'app' }: { ready: boolean; variant?: 'app' | 'kids' }) {
  const state = useInstall();
  const [dismissed, setDismissed] = useState(readGuideDismissed);
  const kind = guideKind(state);
  if (!kind || !shouldShowGuide(kind, ready, dismissed)) return null;
  const kids = variant === 'kids';
  const hide = () => {
    writeGuideDismissed();
    setDismissed(true);
  };
  return (
    <section className={kids ? 'k-gu-card ig ig-kids' : 'card ig'} aria-label="Install Tempo">
      <h2>{TITLE[kind]}</h2>
      {kind !== 'in-app' && <p className={kids ? 'k-gu-note' : 'muted'}>Tempo gets its own icon, opens full screen and works offline, Stockfish included.</p>}
      <InstallSteps kind={kind} />
      {kind !== 'in-app' && <StorageSplitNote mode="install" kids={kids} />}
      <div className="ig-actions">
        {!kids && kind !== 'in-app' && (
          <Button size="s" onClick={() => navigate('settings')}>
            Sync settings
          </Button>
        )}
        {kids ? (
          <button type="button" className="k-gu-btn" onClick={hide}>
            Hide this
          </button>
        ) : (
          <Button size="s" variant="ghost" onClick={hide}>
            Hide this
          </Button>
        )}
      </div>
    </section>
  );
}
