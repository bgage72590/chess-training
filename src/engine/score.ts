// Engine score helpers shared by the browser engine client and the Node scripts.
// Keep this module free of DOM and bundler imports so scripts/lib/uci.ts can use it.

/** Score from the side to move's point of view. Exactly one of cp / mate is set. */
export interface Score {
  cp?: number;
  mate?: number;
}

export interface PvLine {
  multipv: number;
  depth: number;
  score: Score;
  pv: string[];
}

/** Parses a UCI "info ... pv ..." line. Bound-only scores are skipped. */
export function parseInfo(line: string): PvLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ')) return null;
  const t = line.split(' ');
  if (t.includes('lowerbound') || t.includes('upperbound')) return null;
  const get = (k: string) => {
    const i = t.indexOf(k);
    return i >= 0 ? t[i + 1] : undefined;
  };
  const si = t.indexOf('score');
  if (si < 0) return null;
  const score: Score = t[si + 1] === 'mate' ? { mate: Number(t[si + 2]) } : { cp: Number(t[si + 2]) };
  return {
    multipv: Number(get('multipv') ?? 1),
    depth: Number(get('depth') ?? 0),
    score,
    pv: t.slice(t.indexOf('pv') + 1),
  };
}

/** Builds the UCI "go" command for a search budget. */
export function goCommand(o: { depth?: number; movetime?: number; nodes?: number; searchmoves?: string[] }, fallbackDepth?: number): string {
  let go = 'go';
  if (o.depth) go += ` depth ${o.depth}`;
  if (o.movetime) go += ` movetime ${o.movetime}`;
  if (o.nodes) go += ` nodes ${o.nodes}`;
  if (fallbackDepth && !o.depth && !o.movetime && !o.nodes) go += ` depth ${fallbackDepth}`;
  if (o.searchmoves?.length) go += ` searchmoves ${o.searchmoves.join(' ')}`;
  return go;
}

/** Converts a score to centipawns, mapping mates to ±(100000 - distance). */
export function scoreToCp(s: Score): number {
  if (s.mate !== undefined) {
    if (s.mate === 0) return -100000;
    return s.mate > 0 ? 100000 - s.mate * 100 : -100000 - s.mate * 100;
  }
  return s.cp ?? 0;
}

/** Lichess-style win percentage (0..100) for the side the score belongs to. */
export function winPercent(s: Score | undefined): number {
  if (!s) return 50;
  if (s.mate !== undefined) return s.mate > 0 ? 100 : 0;
  const cp = Math.max(-1000, Math.min(1000, s.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Flips a side-to-move score to White's point of view. */
export function whitePov(s: Score, turn: 'w' | 'b'): Score {
  if (turn === 'w') return s;
  return s.mate !== undefined ? { mate: -s.mate } : { cp: -(s.cp ?? 0) };
}

export function formatScore(s: Score | undefined): string {
  if (!s) return '0.0';
  if (s.mate !== undefined) return s.mate === 0 ? '#' : `${s.mate > 0 ? '' : '-'}M${Math.abs(s.mate)}`;
  const v = (s.cp ?? 0) / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}
