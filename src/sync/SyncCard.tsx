import { useEffect, useState } from 'react';
import './sync.css';
import { Button, Feedback } from '../components/ui';
import { toast } from '../lib/toast';
import { APP_URL } from '../pwa/install';
import { APP_ADDRESS } from '../components/InstallCard';
import { useSyncState } from '../store/cloud';
import { formatSyncCode, newSyncCode, normalizeSyncCode, syncLink } from './code';
import { embedded, sync, syncAvailable, useSync } from './index';
import { WhatSyncs } from './WhatSyncs';

function ago(t: number | null): string {
  if (!t) return 'not yet';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** A QR code (rendered as one SVG path) so a phone can scan the sync link. */
function QrCode({ text }: { text: string }) {
  const [shape, setShape] = useState<{ n: number; d: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void import('qrcode-generator').then(({ default: qrcode }) => {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      if (alive) setShape({ n, d });
    });
    return () => {
      alive = false;
    };
  }, [text]);
  if (!shape) return <div className="sync-qr" aria-hidden="true" />;
  return (
    <svg className="sync-qr" viewBox={`-2 -2 ${shape.n + 4} ${shape.n + 4}`} role="img" aria-label="QR code for the sync link">
      <rect x="-2" y="-2" width={shape.n + 4} height={shape.n + 4} fill="#fff" />
      <path d={shape.d} fill="#000" />
    </svg>
  );
}

const STATUS: Record<string, string> = {
  syncing: 'Syncing…',
  offline: 'Offline: changes will sync when you are back online.',
  error: 'Could not reach the sync service; it will try again.',
};

/**
 * Links this device and says how it went: `join` links to another device's copy (a code with no
 * copy is refused), otherwise the code is new and the first sync creates the copy. Resolves to
 * whether the device is now linked.
 */
export async function linkDevice(code: string, join: boolean): Promise<boolean> {
  const bad = { icon: 'x', tone: 'bad' } as const;
  try {
    if (!(await sync.link(code, { mustExist: join }))) {
      toast({ title: 'No synced copy found for this code', body: 'Check the code and try again.', ...bad });
      return false;
    }
  } catch {
    toast({ title: 'Could not reach the sync service', body: 'Check your connection and try again.', ...bad });
    return false;
  }
  // Linking clears lastSyncedAt, so it is set only if the first sync went through.
  if (sync.snapshot.lastSyncedAt) toast({ title: join ? 'Device linked' : 'Sync is on', body: 'Progress on this device now follows the synced copy.', icon: 'check', tone: 'good' });
  else toast({ title: 'Sync code saved', body: "The sync service can't be reached yet; this device will keep trying.", ...bad });
  return true;
}

/** Deletes the synced copy for every device and says how it went (it fails when offline). */
export function deleteSyncedCopy(): Promise<void> {
  return sync.deleteCopy().then(
    () => toast({ title: 'Synced copy deleted', body: 'Progress on this device stays here.', icon: 'check', tone: 'good' }),
    () => toast({ title: 'Could not delete the synced copy', body: 'Check your connection and try again.', icon: 'x', tone: 'bad' }),
  );
}

/** The single-file or embedded copy: sync (and Pip's recorded voices) are in the full app. */
function SyncInFullApp() {
  const cloud = useSyncState();
  return (
    <section className="card settings-section sync-card">
      <h2>Sync across devices</h2>
      <p className="muted">
        Syncing across devices with a private sync code, and Pip&rsquo;s recorded voices in Kids mode, come with the full app at <span className="mono app-address">{APP_ADDRESS}</span>.
      </p>
      <p>
        <a href={APP_URL} target="_blank" rel="noreferrer">
          Open the full app
        </a>
      </p>
      <p className="faint">
        {cloud === 'synced' || cloud === 'saving' ? 'This copy keeps progress in your claude.ai account and in this browser.' : 'This copy keeps progress in this browser.'} Export and Import below move it.
      </p>
    </section>
  );
}

/** Settings section: sync progress across devices with a private sync code. */
export function SyncCard() {
  const s = useSync();
  const [joining, setJoining] = useState(false);
  const [input, setInput] = useState('');
  const [bad, setBad] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!syncAvailable) return embedded ? <SyncInFullApp /> : null;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${what} copied`, icon: 'check', tone: 'good' });
    } catch {
      toast({ title: 'Copy blocked', body: 'Select the text and copy it by hand.', icon: 'x', tone: 'bad' });
    }
  };

  if (!s.code) {
    return (
      <section className="card settings-section sync-card">
        <h2>Sync across devices</h2>
        <p className="muted">
          Keep your progress, and your kids&rsquo; progress, on every phone, tablet and computer. No account or email needed: Tempo gives you a private sync code.
        </p>
        {s.error && <Feedback tone="warn" icon="x" title="Sync stopped" body={s.error} />}
        {!joining ? (
          <div className="btn-row">
            <Button variant="primary" icon="repeat" onClick={() => void linkDevice(newSyncCode(), false)}>
              Turn on sync
            </Button>
            <Button variant="ghost" onClick={() => setJoining(true)}>
              I have a sync code
            </Button>
          </div>
        ) : (
          <form
            className="sync-join"
            onSubmit={(e) => {
              e.preventDefault();
              const code = normalizeSyncCode(input);
              if (!code) return setBad(true);
              void linkDevice(code, true);
            }}
          >
            <label htmlFor="sync-code" className="stat-label">
              Sync code from your other device
            </label>
            <input id="sync-code" className="mono" autoComplete="off" spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" value={input} onChange={(e) => (setInput(e.target.value), setBad(false))} />
            {bad && <span className="move-input-msg">That is not a sync code (20 letters and digits).</span>}
            <div className="btn-row">
              <Button variant="primary" type="submit">
                Link this device
              </Button>
              <Button variant="ghost" onClick={() => setJoining(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>
    );
  }

  const url = syncLink(s.code);
  return (
    <section className="card settings-section sync-card">
      <h2>Sync across devices</h2>
      <p className="muted">
        On another device, scan the code, open the link, or enter the sync code in Settings. Progress from all linked devices is combined.
      </p>
      <div className="sync-link">
        <QrCode text={url} />
        <div className="sync-code-box">
          <span className="stat-label">Your sync code</span>
          <strong className="mono sync-code">{formatSyncCode(s.code)}</strong>
          <div className="btn-row">
            <Button size="s" onClick={() => void copy(formatSyncCode(s.code!), 'Sync code')}>
              Copy code
            </Button>
            <Button size="s" variant="ghost" onClick={() => void copy(url, 'Link')}>
              Copy link
            </Button>
            {typeof navigator.share === 'function' && (
              <Button size="s" variant="ghost" onClick={() => void navigator.share({ title: 'Tempo sync link', url }).catch(() => undefined)}>
                Share
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="faint">{STATUS[s.status] ?? `Last synced ${ago(s.lastSyncedAt)}.`}</p>
      <WhatSyncs />
      <Feedback tone="warn" icon="lock" title="Keep this code private" body="Anyone with it can see and change this progress, like a password." />
      <div className="btn-row">
        <Button icon="refresh" onClick={() => void sync.syncNow()} disabled={s.status === 'syncing'}>
          Sync now
        </Button>
        <Button variant="ghost" onClick={() => sync.unlink()}>
          Stop syncing on this device
        </Button>
        {!confirmDelete ? (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            Delete synced copy…
          </Button>
        ) : (
          <Button variant="danger" onClick={() => void deleteSyncedCopy().finally(() => setConfirmDelete(false))}>
            Delete it for all devices
          </Button>
        )}
      </div>
    </section>
  );
}
