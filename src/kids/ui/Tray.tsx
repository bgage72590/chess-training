// The bottom action area: big answer buttons (2 per row for Sprouts, up to 4 otherwise).
import type { AgeBand, TrayButton } from '../activities/types';
import { bandText } from '../activities/types';
import { BigButton } from './BigButton';

export function Tray({ buttons, band }: { buttons: TrayButton[] | null; band: AgeBand }) {
  if (!buttons?.length) return null;
  return (
    <div className={`k-tray cols-${band === 'sprout' ? Math.min(2, buttons.length) : Math.min(4, buttons.length)}`}>
      {buttons.map((b) =>
        b.inert ? (
          <div key={b.id} className={`k-btn k-btn-${b.variant ?? 'plain'} k-btn-static`} role="img" aria-label={b.ariaLabel ?? bandText(b.label, band)}>
            {b.art}
            {bandText(b.label, band)}
          </div>
        ) : (
          <BigButton key={b.id} variant={b.variant ?? 'plain'} icon={b.icon} disabled={b.disabled || b.placeholder} onClick={b.onPress} aria-label={b.ariaLabel} aria-hidden={b.placeholder || undefined}>
            {b.art}
            {bandText(b.label, band)}
          </BigButton>
        ),
      )}
    </div>
  );
}
