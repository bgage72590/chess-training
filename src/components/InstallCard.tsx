import { APP_URL, install, useInstall } from '../pwa/install';
import { Button } from './ui';
import { Icon } from './Icon';
import { guideKind, InstallSteps } from './InstallGuide';
import { StorageSplitNote } from './StorageSplitNote';

const HOW: Record<string, string> = {
  menu: 'Click the install icon at the right of the address bar, or open the browser menu and choose Install Tempo (on Android: Add to Home screen).',
  unsupported: 'This browser cannot install web apps. Open Tempo in Chrome, Edge or Safari to install it.',
  'safari-old': 'This version of Safari cannot add web apps to the Dock. Update macOS (Add to Dock needs macOS 14 Sonoma or later) or open Tempo in Chrome or Edge to install it.',
  'in-app': 'Open this page in Chrome first: the browser built into this app cannot install Tempo. Look for Open in browser in its menu.',
};

/** The app's address, shown as text to select or type (a link may open inside the same sandbox). */
export const APP_ADDRESS = APP_URL.replace(/^https?:\/\/|\/$/g, '');

/** Settings section: install Tempo as an app with its own icon. */
export function InstallCard() {
  const s = useInstall();
  // On an iPhone or iPad an in-app browser needs the Safari steps; anything else gets HOW.
  const kind = guideKind({ ...s, installed: false });
  return (
    <section className="card settings-section">
      <h2>Install the app</h2>
      {s.installed ? (
        <p className="muted">You are using the installed app. Open it from its icon any time; it works offline, Stockfish included.</p>
      ) : s.how === 'elsewhere' ? (
        <>
          <p className="muted">
            Open <span className="mono app-address">{APP_ADDRESS}</span> in your browser (Chrome, Edge or Safari) to install it. Progress stays with each copy: move it with Export and Import below.
          </p>
          <p>
            <a href={APP_URL} target="_blank" rel="noreferrer">
              Open the full app
            </a>
          </p>
        </>
      ) : (
        <>
          <p className="muted">Tempo can live on your dock, Start menu or home screen like any other app. It opens in its own window and works offline, Stockfish included.</p>
          {s.canPrompt ? (
            <div className="btn-row">
              <Button variant="primary" icon="download" onClick={() => void install()}>
                Install Tempo
              </Button>
            </div>
          ) : kind ? (
            <>
              {kind === 'in-app' && <p><strong>Open this page in Safari first.</strong></p>}
              <InstallSteps kind={kind} />
              {kind !== 'in-app' && <StorageSplitNote mode="install" />}
            </>
          ) : (
            <p>{HOW[s.how]}</p>
          )}
        </>
      )}
    </section>
  );
}

/** Small install button for the app shell; shown only while the browser offers an install. */
export function InstallButton({ compact }: { compact?: boolean }) {
  const s = useInstall();
  if (s.installed || !s.canPrompt) return null;
  return compact ? (
    <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Install Tempo" title="Install Tempo" onClick={() => void install()}>
      <Icon name="download" size={18} />
    </button>
  ) : (
    <Button variant="ghost" size="s" icon="download" onClick={() => void install()}>
      Install app
    </Button>
  );
}
