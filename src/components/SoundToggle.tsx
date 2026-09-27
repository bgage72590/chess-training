// One-tap mute for the grown-up app (sidebar, phone header, and the M key anywhere).
import { useEffect } from 'react';
import { getSettings, updateProfile, useProfile } from '../store/profile';
import { sound } from '../chess/sound';
import { toast } from '../lib/toast';
import { Icon } from './Icon';

export function toggleSound() {
  const on = !getSettings().sound;
  updateProfile((d) => {
    d.settings.sound = on;
    if (on && d.settings.volume === 0) d.settings.volume = 0.8;
  });
  if (on) sound('move');
  toast({ title: on ? 'Sound on' : 'Sound off', icon: on ? 'volume' : 'mute' }, 1600);
}

/** M toggles sound, except while typing (and in Kids mode). */
export function useSoundShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'm' && e.key !== 'M') return;
      if (location.hash.startsWith('#/kids')) return; // Kids mode has its own speaker button
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      toggleSound();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function SoundToggle({ compact }: { compact?: boolean }) {
  const on = useProfile().settings.sound;
  const label = on ? 'Mute sounds (M)' : 'Turn sounds on (M)';
  if (compact)
    return (
      <button type="button" className={`icon-btn sound-toggle${on ? '' : ' off'}`} aria-label={label} aria-pressed={!on} title={label} onClick={toggleSound}>
        <Icon name={on ? 'volume' : 'mute'} size={18} />
      </button>
    );
  return (
    <button type="button" className={`sound-toggle sound-toggle-row${on ? '' : ' off'}`} aria-pressed={!on} title={label} onClick={toggleSound}>
      <Icon name={on ? 'volume' : 'mute'} size={18} />
      <span>{on ? 'Sound on' : 'Sound off'}</span>
      <kbd>M</kbd>
    </button>
  );
}
