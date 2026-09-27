import { describe, expect, it } from 'vitest';
import { WORLDS, nodesOf } from '../src/kids/curriculum/worlds';
import { isRegistered, PACKS, PLAYGROUND } from '../src/kids/packs';

describe('Kids mode with every pack installed', () => {
  it('has an activity for every node on the map (no "Coming soon" left)', () => {
    const missing = WORLDS.flatMap((w) => nodesOf(w.id).map((n) => n.id)).filter((id) => !isRegistered(id));
    expect(missing).toEqual([]);
  });

  it('registers all six packs and their playground games', () => {
    expect(PACKS.map((p) => p.id)).toEqual(['core', 'movement', 'minigames', 'rules', 'buddies', 'tactics']);
    expect(PLAYGROUND.length).toBeGreaterThanOrEqual(10);
    expect(new Set(PLAYGROUND.map((p) => p.id)).size).toBe(PLAYGROUND.length);
  });
});
