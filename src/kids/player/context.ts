// The active kid, band and tuning for everything under KidsApp.
import { createContext, useContext } from 'react';
import type { AgeBand } from '../activities/types';
import type { KidProfile } from '../store/kidsStore';
import { BAND_TUNING, type BandTuning } from '../curriculum/tuning';

export interface KidCtx {
  kid: KidProfile | null;
  band: AgeBand;
  tuning: BandTuning;
  reducedMotion: boolean;
}

export const KidContext = createContext<KidCtx>({ kid: null, band: 'explorer', tuning: BAND_TUNING.explorer, reducedMotion: false });

export const useKidCtx = () => useContext(KidContext);
