// Age-band tuning (spec section 2) and item resolution (tune / superTune / ease merges).
import type { AgeBand, ItemMeta, Tier } from '../activities/types';

export interface BandTuning {
  bodyPx: number;
  bubblePx: number;
  titlePx: number;
  buttonPx: number;
  buttonLabelPx: number;
  gapPx: number;
  captionMaxWords: number;
  voice: 'auto' | 'first' | 'off';
  speechRate: number;
  pitch: number;
  itemsPerRun: number;
  startTier: Tier;
  /** Mistakes before the hint ladder steps up by itself. */
  hintAfterWrong: number;
  /** Champion: the ladder is only offered (the bulb pulses) after this many mistakes. */
  hintOfferOnly: boolean;
  hintAfterIdleSec: number | null;
  /** Champion: the bulb pulses after this many idle seconds. */
  bulbPulseSec: number | null;
  showDests: 'always' | 'until-mastered' | 'on-mistake';
  autoSelectLone: boolean;
  coordinates: boolean;
  notation: 'never' | 'spoken' | 'san';
  lavaVisible: 'always' | 'after-mistake';
  parSlack: number;
  takebacks: 'always' | 'three' | 'one';
  dangerAlarm: 'locked-on' | 'on' | 'kid-can-off';
  threatLights: boolean;
  promotion: 'auto' | 'picker';
  bossPass: 1 | 2;
  warmupItems: number;
  sessionMinDefault: 10 | 20 | 30;
  placementCap: number; // highest checkpoint world (1..8)
  timers: 'none' | 'dash-only';
  pipChatter: 'full' | 'short' | 'coach';
  tapOnly: boolean;
  dangerThreshold: number;
}

export const BAND_TUNING: Record<AgeBand, BandTuning> = {
  sprout: {
    bodyPx: 22,
    bubblePx: 24,
    titlePx: 36,
    buttonPx: 72,
    buttonLabelPx: 26,
    gapPx: 12,
    captionMaxWords: 6,
    voice: 'auto',
    speechRate: 0.9,
    pitch: 1,
    itemsPerRun: 3,
    startTier: 1,
    hintAfterWrong: 1,
    hintOfferOnly: false,
    hintAfterIdleSec: 10,
    bulbPulseSec: null,
    showDests: 'always',
    autoSelectLone: true,
    coordinates: false,
    notation: 'never',
    lavaVisible: 'always',
    parSlack: 1,
    takebacks: 'always',
    dangerAlarm: 'locked-on',
    threatLights: true,
    promotion: 'auto',
    bossPass: 1,
    warmupItems: 1,
    sessionMinDefault: 10,
    placementCap: 5,
    timers: 'none',
    pipChatter: 'full',
    tapOnly: true,
    dangerThreshold: 3,
  },
  explorer: {
    bodyPx: 19,
    bubblePx: 20,
    titlePx: 32,
    buttonPx: 56,
    buttonLabelPx: 22,
    gapPx: 12,
    captionMaxWords: 10,
    voice: 'first',
    speechRate: 0.95,
    pitch: 1,
    itemsPerRun: 5,
    startTier: 1,
    hintAfterWrong: 2,
    hintOfferOnly: false,
    hintAfterIdleSec: 25,
    bulbPulseSec: null,
    showDests: 'until-mastered',
    autoSelectLone: true,
    coordinates: false,
    notation: 'spoken',
    lavaVisible: 'after-mistake',
    parSlack: 0,
    takebacks: 'three',
    dangerAlarm: 'on',
    threatLights: false,
    promotion: 'picker',
    bossPass: 2,
    warmupItems: 2,
    sessionMinDefault: 20,
    placementCap: 8,
    timers: 'none',
    pipChatter: 'short',
    tapOnly: false,
    dangerThreshold: 3,
  },
  champion: {
    bodyPx: 17,
    bubblePx: 18,
    titlePx: 28,
    buttonPx: 48,
    buttonLabelPx: 19,
    gapPx: 8,
    captionMaxWords: 16,
    voice: 'off',
    speechRate: 1.0,
    pitch: 1.0,
    itemsPerRun: 6,
    startTier: 2,
    hintAfterWrong: 2,
    hintOfferOnly: true,
    hintAfterIdleSec: null,
    bulbPulseSec: 40,
    showDests: 'on-mistake',
    autoSelectLone: false,
    coordinates: true,
    notation: 'san',
    lavaVisible: 'after-mistake',
    parSlack: 0,
    takebacks: 'one',
    dangerAlarm: 'kid-can-off',
    threatLights: false,
    promotion: 'picker',
    bossPass: 2,
    warmupItems: 3,
    sessionMinDefault: 30,
    placementCap: 8,
    timers: 'dash-only',
    pipChatter: 'coach',
    tapOnly: false,
    dangerThreshold: 2,
  },
};

export const BANDS: AgeBand[] = ['sprout', 'explorer', 'champion'];

export const bandOfAge = (age: number): AgeBand => (age <= 6 ? 'sprout' : age <= 9 ? 'explorer' : 'champion');

export const BAND_LABEL: Record<AgeBand, string> = { sprout: 'Sprout (4-6)', explorer: 'Explorer (7-9)', champion: 'Champion (10-12)' };

/** Is an item visible to a band? */
export const visibleTo = (item: ItemMeta, band: AgeBand) => !item.bands || item.bands.includes(band);

/**
 * A shallow merge of `item`, then `item.tune[band]`, then `superTune` (if `super`), then the
 * first `ease` easier variants in order.
 */
export function resolveItem<I extends ItemMeta>(item: I, band: AgeBand, opts: { super?: boolean; ease?: number } = {}): I {
  let out: I = { ...item, ...(item.tune?.[band] ?? {}) };
  if (opts.super && item.superTune) out = { ...out, ...item.superTune };
  const steps = item.ease ?? [];
  for (let i = 0; i < Math.min(opts.ease ?? 0, steps.length); i++) out = { ...out, ...steps[i] };
  return out;
}
