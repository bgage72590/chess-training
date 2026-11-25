import { useEffect, useState } from 'react';
import { askWorker, offlineState, offlineSupported, workerBlocked, type OfflineState } from '../pwa/offline';
import { useInstall } from '../pwa/install';
import { storageStatus, type StorageStatus } from '../lib/storage';
import { useSync } from '../sync';
import { Button } from './ui';

/** Megabytes (decimal, as storage screens show them): '44 MB', or '4.4 MB' for small sizes. */
const formatSize = (bytes: number) => `${bytes / 1e6 < 10 ? (bytes / 1e6).toFixed(1) : Math.round(bytes / 1e6)} MB`;

/** Whether Tempo works without the internet: the app itself, and whether the browser will keep the data. */
export function OfflineCard() {
  const supported = offlineSupported();
  const [app, setApp] = useState<OfflineState | 'checking'>('checking');
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const install = useInstall();
  const linked = !!useSync().code;

  useEffect(() => {
    if (!supported) return;
    let live = true;
    const check = (retry = true) => {
      const sw = navigator.serviceWorker;
      void askWorker(sw).then(async (status) => {
        if (!live) return;
        const state = offlineState(!!sw.controller, status);
        if (state === 'ready') return setApp(state);
        // A first visit registers its worker a moment after loading: look again once before saying it is blocked.
        const registered = !!(await sw.getRegistration().catch(() => undefined));
        if (!live) return;
        if (!workerBlocked(!!sw.controller, registered)) return setApp(state);
        if (retry) return void setTimeout(() => live && check(false), 5000);
        setApp('unavailable');
      });
    };
    check();
    // The worker takes control of a first visit's page once it has installed: ask again then.
    const again = () => check();
    navigator.serviceWorker.addEventListener('controllerchange', again);
    void storageStatus().then((s) => live && setStorage(s));
    return () => {
      live = false;
      navigator.serviceWorker.removeEventListener('controllerchange', again);
    };
  }, [supported]);

  if (!supported) return null;
  // A Safari tab (unlike the app added to the Home Screen) is cleared after about a week unused.
  const safariTab = !install.installed && (install.how === 'ios' || install.how === 'safari-mac');
  return (
    <section className="card settings-section">
      <h2>Offline</h2>
      {app === 'checking' ? (
        <p className="muted">Checking what is saved on this device…</p>
      ) : app === 'ready' ? (
        <p>
          <strong>Ready offline</strong>
          <span className="muted"> Every part of Tempo, Stockfish included, is saved on this device.</span>
        </p>
      ) : app === 'unavailable' ? (
        <p>
          <strong>Saving for offline use is not available in this window</strong>
          <span className="muted"> Private windows and some browsers do not allow it. Open Tempo in a normal window to use it without the internet.</span>
        </p>
      ) : (
        <>
          <p>
            <strong>Reload once to finish saving Tempo for offline use</strong>
          </p>
          <div className="btn-row">
            <Button icon="refresh" onClick={() => location.reload()}>
              Reload
            </Button>
          </div>
        </>
      )}
      {storage?.supported && (
        <>
          <p>
            <strong>Your data: {storage.persisted ? 'protected' : 'may be cleared by the browser'}</strong>
            {storage.usage != null && storage.usage >= 1e6 && <span className="muted"> Tempo uses {formatSize(storage.usage)} on this device.</span>}
          </p>
          <p className="muted">
            {storage.persisted
              ? 'The browser has agreed to keep your progress, even when the device runs low on space.'
              : 'A browser may clear a website’s data when the device runs low on space. Tempo asks it to keep yours once you have finished a lesson, a puzzle or a game.'}
            {safariTab && ' Safari also clears the data of a site opened in a tab after about a week without a visit. '}
            {safariTab && (linked ? 'Your sync code backs up your progress, and the app added to your Home Screen is kept longer.' : 'Turn on sync above: your sync code backs up your progress. The app added to your Home Screen is kept longer.')}
          </p>
        </>
      )}
    </section>
  );
}
