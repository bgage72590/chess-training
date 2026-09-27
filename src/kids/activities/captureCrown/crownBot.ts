// crownBot (spec 13.8): three friendly levels for Capture the Crown. Pure; the component adds
// the thinking delay.
import type { PieceCode, Placement, Sq } from '../types';
import { attacks } from '../../lib/miniRules';
import { crownMoves, playCrown, type Color, type CrownBotLevel, type CrownMove, type CrownState } from './logic';

export const CROWN_VALUE: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 100 };
const val = (p: PieceCode | undefined) => (p ? CROWN_VALUE[p.toUpperCase()] : 0);
const pick = <T>(rng: () => number, a: T[]): T => a[Math.floor(rng() * a.length) % a.length];
const isKingCapture = (m: CrownMove) => m.capture === 'K' || m.capture === 'k';

/** The enemy pieces that attack `sq` in `pos` (enemy of `color`). */
function attackers(pos: Placement, sq: Sq, color: Color): PieceCode[] {
  const occ = new Set(Object.keys(pos));
  const out: PieceCode[] = [];
  for (const [s, p] of Object.entries(pos)) {
    if (!p || (p === p.toUpperCase()) === (color === 'w')) continue;
    if (attacks(p, s, occ).includes(sq)) out.push(p);
  }
  return out;
}

/** After our move, is our king capturable? */
const kingHangs = (st: CrownState, color: Color) => crownMoves(st).some((m) => m.capture === (color === 'w' ? 'K' : 'k'));

function playful(st: CrownState, rng: () => number): CrownMove {
  const me = st.turn;
  const moves = crownMoves(st);
  const kingCap = moves.find(isKingCapture);
  if (kingCap) return kingCap;
  // Keep our own king out of reach when we can.
  const safe = moves.filter((m) => !kingHangs(playCrown(st, m), me));
  const pool = safe.length ? safe : moves;
  const good = pool.filter((m) => {
    if (!m.capture) return false;
    const after = playCrown(st, m).pos;
    const cheaper = attackers(after, m.to, me).some((a) => val(a) < val(st.pos[m.from]));
    return !cheaper || val(m.capture) >= val(st.pos[m.from]);
  });
  if (good.length) {
    const top = Math.max(...good.map((m) => val(m.capture)));
    return pick(rng, good.filter((m) => val(m.capture) === top));
  }
  const quiet = pool.filter((m) => !attackers(playCrown(st, m).pos, m.to, me).length);
  return pick(rng, quiet.length ? quiet : pool);
}

function clever(st: CrownState, rng: () => number): CrownMove {
  let best = -Infinity;
  let pool: CrownMove[] = [];
  for (const m of crownMoves(st)) {
    let s: number;
    if (isKingCapture(m)) s = 1000;
    else {
      const child = playCrown(st, m);
      const reply = Math.max(0, ...crownMoves(child).map((r) => val(r.capture)));
      s = val(m.capture) - reply;
    }
    if (s > best) {
      best = s;
      pool = [m];
    } else if (s === best) pool.push(m);
  }
  return pick(rng, pool);
}

/** The bot's move for the side to move (null when it has none). */
export function crownBotMove(st: CrownState, level: CrownBotLevel, rng: () => number): CrownMove | null {
  const moves = crownMoves(st);
  if (!moves.length) return null;
  if (level === 'sleepy') return moves.find(isKingCapture) ?? pick(rng, moves);
  if (level === 'playful') return playful(st, rng);
  return clever(st, rng);
}

