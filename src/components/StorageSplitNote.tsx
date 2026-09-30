import './install.css';
import { useInstall, type InstallHow } from '../pwa/install';
import { syncAvailable, useSync } from '../sync';

/** Where the note is shown: before installing (the install card and banner, the sync join page, the
 *  sync card with a code) or inside the installed app. */
export type StorageMode = 'install' | 'join' | 'synced' | 'installed';

interface Facts {
  mode: StorageMode;
  how: InstallHow;
  installed: boolean;
  /** This device already has a sync code. */
  linked: boolean;
  /** Sync works here (a backend is configured and this is not an embedded copy). */
  sync: boolean;
  /** Shown in Kids' grown-ups area, where sync and export live elsewhere. */
  kids?: boolean;
}

/**
 * On iPhone, iPad and Mac Safari the browser tab and the installed Home Screen (or Dock) app keep
 * separate data, and a sync link opens in the browser, never in the installed app. Progress made
 * before installing therefore has to travel by sync code or by export. Null where that does not apply.
 */
export function storageSplitText({ mode, how, installed, linked, sync, kids }: Facts): string | null {
  if (how !== 'ios' && how !== 'safari-mac') return null;
  if ((mode === 'installed') !== installed) return null;
  const app = how === 'ios' ? 'Home Screen app' : 'Dock app';
  const opens = 'A sync link opens in Safari, not in the installed app';
  switch (mode) {
    case 'install':
      if (!sync) return `The ${app} keeps its own data, separate from this Safari tab, so your progress does not carry over by itself. Before you install, export your progress${kids ? ' (Export kids data, below)' : ' (Settings, Your data)'}. Then open the installed app and paste it into Import.`;
      if (linked) return `The ${app} keeps its own data, separate from this Safari tab. Sync is on, so your progress is safe: after you install, open the installed app, go to Settings, choose “I have a sync code” and type your code. ${opens}, so type the code in.`;
      return `The ${app} keeps its own data, separate from this Safari tab, so your progress does not carry over by itself. Before you install, turn on sync ${kids ? "in Tempo's Settings" : 'in Settings'} (or export your progress${kids ? ': Export kids data, below' : ''}). Then open the installed app and choose “I have a sync code”. ${opens}, so type the code in.`;
    case 'join':
      return `Going to use Tempo from your ${how === 'ios' ? 'Home Screen' : 'Dock'}? The installed app keeps its own data, and this link opens in Safari, not in the app. Install Tempo first, open it from its icon, go to Settings, choose “I have a sync code” and type the code above. To keep using Tempo in Safari, link this device here.`;
    case 'synced':
      return `The link and QR code open in Safari, not in the installed app, which keeps its own data. To use this code in the installed Tempo, open it, go to Settings, choose “I have a sync code” and type the code.`;
    case 'installed':
      return sync
        ? `This installed app keeps its own data, separate from Safari. To bring your progress here, turn on sync where it is now, then choose “I have a sync code” here and type the code. ${opens}.`
        : 'This installed app keeps its own data, separate from Safari. To bring your progress here, export it where it is now and paste it into Import (Settings, Your data).';
  }
}

/** A short note that the browser tab and the installed app do not share progress (see storageSplitText). */
export function StorageSplitNote({ mode, kids }: { mode: StorageMode; kids?: boolean }) {
  const { how, installed } = useInstall();
  const linked = !!useSync().code;
  const text = storageSplitText({ mode, how, installed, linked, sync: syncAvailable, kids });
  if (!text) return null;
  return (
    <p className="ig-note" role="note">
      {text}
    </p>
  );
}
