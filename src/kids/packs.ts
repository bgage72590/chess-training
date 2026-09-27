// The Kids registry: every installed pack's activities, level sets and playground entries.
// A pack's only shared-file edit is its import line and its entry in PACKS (spec 11.2).
import type { ActivityDef, KidsPack, LevelSet, PlaygroundEntry } from './activities/types';
import { corePack, CHECKPOINTS as CORE_CHECKPOINTS } from './content/core';
// PACK A: import { movementPack } from './content/movement';
// PACK B: import { minigamesPack } from './content/minigames';
// PACK C: import { rulesPack } from './content/rules';
import { buddiesPack } from './content/games';
// PACK E: import { tacticsPack } from './content/tactics';

export const PACKS: KidsPack[] = [corePack, buddiesPack /* , movementPack, minigamesPack, rulesPack, tacticsPack */];

export interface KidsRegistry {
  packs: KidsPack[];
  ACTIVITIES: Map<string, ActivityDef<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
  LEVEL_SETS: Map<string, LevelSet<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
  PLAYGROUND: PlaygroundEntry[];
  isRegistered(nodeId: string): boolean;
}

/** Builds a registry from a pack list (tests use fake lists to check the missing-pack rules). */
export function createRegistry(packs: KidsPack[]): KidsRegistry {
  const ACTIVITIES = new Map(packs.flatMap((p) => p.activities).map((a) => [a.id, a]));
  const LEVEL_SETS = new Map(packs.flatMap((p) => p.levelSets).map((s) => [s.id, s]));
  const PLAYGROUND = packs.flatMap((p) => p.playground ?? []);
  return {
    packs,
    ACTIVITIES,
    LEVEL_SETS,
    PLAYGROUND,
    isRegistered(nodeId: string) {
      const s = LEVEL_SETS.get(nodeId);
      return !!s && ACTIVITIES.has(s.activity);
    },
  };
}

export const REGISTRY = createRegistry(PACKS);
export const { ACTIVITIES, LEVEL_SETS, PLAYGROUND } = REGISTRY;
export const CHECKPOINTS: Map<string, LevelSet> = new Map(CORE_CHECKPOINTS.map((c) => [c.id, c]));
export const isRegistered = (nodeId: string) => REGISTRY.isRegistered(nodeId);
