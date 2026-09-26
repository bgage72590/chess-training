import { APP_URL, install, useInstall } from '../pwa/install';
import { Button } from './ui';
import { Icon } from './Icon';

const HOW: Record<string, string> = {
  ios: 'In Safari, tap the Share button, then Add to Home Screen.',
  'safari-mac': 'In Safari, choose File, then Add to Dock.',
  menu: 'Click the install icon at the right of the address bar, or open the browser menu and choose Install Tempo (on Android: Add to Home screen).',
  unsupported: 'This browser cannot install web apps. Open Tempo in Chrome, Edge or Safari to install it.',
};

/** Settings section: install Tempo as an app with its own icon. */
export function InstallCard() {
  const s = useInstall();
  return (
    <section className="card settings-section">
      <h2>Install the app</h2>
      {s.installed ? (
        <p className="muted">You are using the installed app. Open it from its icon any time; it works offline, Stockfish included.</p>
      ) : s.how === 'elsewhere' ? (
        <p className="muted">
          Open{' '}
          <a href={APP_URL} target="_blank" rel="noreferrer">
            {APP_URL.replace('https://', '')}
          </a>{' '}
          in Chrome, Edge or Safari and install it from there. Progress stays with each copy: move it with Export and Import below.
        </p>
      ) : (
        <>
          <p className="muted">Tempo can live on your dock, Start menu or home screen like any other app. It opens in its own window and works offline, Stockfish included.</p>
          {s.canPrompt ? (
            <div className="btn-row">
              <Button variant="primary" icon="download" onClick={() => void install()}>
                Install Tempo
              </Button>
            </div>
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
