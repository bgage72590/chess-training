import { useEffect, useState } from 'react';
import { askWorker, offlineState, offlineSupported, workerBlocked, type OfflineState } from '../pwa/offline';
import { useInstall } from '../pwa/install';
import { formatSize, loadVoiceNames, voicePacks } from '../kids/player/voicePack';
import { storageStatus, type StorageStatus } from '../lib/storage';
import { useSync } from '../sync';
import { Button } from './ui';

interface SavedVoice {
  id: string;
  name: string;
  size: number;
  update: boolean;
}

/** Whether Tempo works without the internet: the app itself, the saved voice, and whether the browser will keep the data. */
export function OfflineCard() {
  const supported = offlineSupported();
  const [app, setApp] = useState<OfflineState | 'checking'>('checking');
  const [voices, setVoices] = useState<SavedVoice[] | null>(null);
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
    void (async () => {
      const names = await loadVoiceNames();
      const found: SavedVoice[] = [];
      for (const id of voicePacks.savedIds()) {
        const s = await voicePacks.status(id);
        if (s.kind === 'saved' || s.kind === 'update') found.push({ id, name: names[id] ?? id, size: s.bytes, update: s.kind === 'update' });
      }
      if (live) setVoices(found);
    })();
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
      {voices && (
        <p className="muted">
          {voices.length
            ? `Pip's voice on this device: ${voices.map((v) => `${v.name} (${formatSize(v.size)}${v.update ? ', update available' : ''})`).join(', ')}. It plays without the internet.`
            : "Pip's recorded voices stream as they are used, so offline Pip uses this device's own voice for anything not heard yet. To keep a voice for offline use, open Kids mode, then Grown-ups, pick the voice and tap Download."}
        </p>
      )}
      {storage?.supported && (
        <>
          <p>
            <strong>Your data: {storage.persisted ? 'protected' : 'may be cleared by the browser'}</strong>
            {storage.usage != null && storage.usage >= 1e6 && <span className="muted"> Tempo uses {formatSize(storage.usage)} on this device.</span>}
          </p>
          <p className="muted">
            {storage.persisted
              ? 'The browser has agreed to keep your progress and saved voices, even when the device runs low on space.'
              : 'A browser may clear a website’s data when the device runs low on space. Tempo asks it to keep yours once you have finished a lesson, a puzzle or a game.'}
            {safariTab && ' Safari also clears the data of a site opened in a tab after about a week without a visit. '}
            {safariTab && (linked ? 'Your sync code backs up your progress, and the app added to your Home Screen is kept longer.' : 'Turn on sync above: your sync code backs up your progress. The app added to your Home Screen is kept longer.')}
          </p>
        </>
      )}
    </section>
  );
}
