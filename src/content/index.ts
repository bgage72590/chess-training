import type { EndgameDrill, Opening, Unit } from './types';
import { foundations } from './lessons/foundations';
import { checkmates } from './lessons/checkmates';
import { tactics } from './lessons/tactics';
import { openingPlay } from './lessons/opening-play';
import { endgameTechnique } from './lessons/endgame-technique';
import { strategy } from './lessons/strategy';
import { thinking } from './lessons/thinking';
import { whiteOpenings } from './openings/white';
import { blackOpenings } from './openings/black';
import { drills } from './endgames/drills';

/** The curriculum, in the recommended order. */
export const units: Unit[] = [foundations, checkmates, tactics, openingPlay, thinking, endgameTechnique, strategy];

export const openings: Opening[] = [...whiteOpenings, ...blackOpenings];

export const endgameDrills: EndgameDrill[] = drills;

export * from './types';
