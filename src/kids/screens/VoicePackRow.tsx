// Grown-ups: keeping one of Pip's recorded voices on the device, so it plays without the internet.
// Without this a voice streams as it is used and only the lines already heard are kept. Grown-up
// copy: read, never spoken (scripts/voice/collect.ts leaves this file out).
import { useEffect, useRef, useState } from 'react';
import type { PipVoice } from '../player/speech';
import { formatSize, isIos, megabytes, mustAskFirst, packView, useVoicePack, voicePacks, type PackRun } from '../player/voicePack';
import { IS_NATIVE } from '../../pwa/native';
import './VoicePackRow.css';

const STOPPED: Record<NonNullable<PackRun['reason']>, string> = {
  network: 'It stopped because the connection dropped or a file could not be fetched. Resume when you are back online.',
  space: 'There is not enough free room on this device for this voice.',
  manifest: 'The voice could not be reached. Connect to the internet and try again.',
  busy: 'Another voice is downloading. Wait for it or pause it first.',
};

/** The row for the voice picked in the list above it. One voice at a time: never all eight. */
export function VoicePackRow({ voices, selected }: { voices: PipVoice[]; selected: string }) {
  const voice = voices.find((v) => v.id === selected);
  // The app carries its voices inside it (scripts/build-native.mjs): nothing to download.
  if (IS_NATIVE) return voice ? <p className="k-pack-note">This voice is saved in the app and plays without the internet.</p> : null;
  return voice ? <PackRow key={voice.id} voice={voice} /> : null;
}

function PackRow({ voice }: { voice: PipVoice }) {
  const { run, status, supported, busyWith } = useVoicePack(voice.id);
  const [asking, setAsking] = useState(false);
  // The button that opens the question is replaced by it: keep keyboard and screen-reader focus with
  // the person, on the question and back on the button after 'Not now'.
  const actionRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (asking) {
      moved.current = true;
      confirmRef.current?.focus();
    } else if (moved.current) {
      moved.current = false;
      actionRef.current?.focus();
    }
  }, [asking]);
  const view = packView(run, status);
  const otherBusy = !!busyWith && busyWith !== voice.id;
  const connection = (navigator as Navigator & { connection?: { type?: string; saveData?: boolean } }).connection;
  const ios = isIos();

  const begin = () => {
    setAsking(false);
    void voicePacks.start(voice.id);
  };
  // Asked first unless the connection is known to be Wi-Fi or ethernet, and always on iPhone and iPad.
  const download = () => (mustAskFirst(connection, ios) ? setAsking(true) : begin());

  let text: string;
  let action: { label: string; onClick: () => void } | null = null;
  switch (view.kind) {
    case 'checking':
      text = 'Checking what is on this device';
      break;
    case 'streams':
      text = view.offline ? 'Streams as used. Connect to the internet to save it.' : view.cleared ? 'Streams as used. The browser cleared part of the saved voice.' : 'Streams as used';
      if (!view.offline && supported && view.size > 0) action = { label: `Download ${formatSize(view.size)}`, onClick: download };
      break;
    case 'downloading':
      text = view.total > 0 ? `Downloading ${view.pct}% (${megabytes(view.done)} of ${formatSize(view.total)})` : 'Starting the download';
      action = { label: 'Pause', onClick: () => voicePacks.pause(voice.id) };
      break;
    case 'paused':
      text = `Paused at ${view.pct}% (${megabytes(view.done)} of ${formatSize(view.total)})`;
      action = { label: 'Resume', onClick: begin };
      break;
    case 'failed':
      text = view.reason ? STOPPED[view.reason] : STOPPED.network;
      if (view.reason !== 'space' && view.reason !== 'busy') action = { label: view.done > 0 ? 'Resume' : 'Try again', onClick: begin };
      break;
    case 'saved':
      text = `On this device (${formatSize(view.size)}). Plays without the internet.`;
      break;
    case 'update':
      text = 'Update available (a new recording)';
      if (supported) action = { label: `Update ${formatSize(view.size)}`, onClick: download };
      break;
  }
  const working = view.kind === 'downloading';
  return (
    <div className="k-gu-row k-pack-row">
      <span className="k-gu-label">
        {voice.name} offline
        <small>{text}</small>
      </span>
      {action && !asking && (
        <button ref={actionRef} type="button" className="k-gu-btn" onClick={action.onClick} disabled={otherBusy && view.kind !== 'downloading'}>
          {action.label}
        </button>
      )}
      {asking && (
        <div className="k-pack-ask">
          <span>
            {ios ? 'This is a large download, and the screen must stay open until it finishes. It may use mobile data.' : 'This is a large download and may use mobile data.'} Save {voice.name} ({formatSize(view.kind === 'streams' || view.kind === 'update' ? view.size : 0)}) now?
          </span>
          <div className="k-gu-inline">
            <button ref={confirmRef} type="button" className="k-gu-btn" onClick={begin}>
              Download now
            </button>
            <button type="button" className="k-gu-btn" onClick={() => setAsking(false)}>
              Not now
            </button>
          </div>
        </div>
      )}
      {working && (
        <div className="k-pack-bar" role="progressbar" aria-label={`${voice.name} download`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.pct}>
          <span style={{ width: `${view.pct}%` }} />
        </div>
      )}
      {working && ios && <small className="k-pack-keep">Keep Tempo open until it finishes: the download pauses if you switch away.</small>}
      {otherBusy && view.kind !== 'downloading' && <small className="k-pack-keep">Another voice is downloading. One at a time.</small>}
    </div>
  );
}
