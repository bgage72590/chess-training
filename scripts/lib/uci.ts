// Minimal UCI client that runs the Stockfish WASM build under Node as a child process.
// Used by the content validator and the puzzle generator.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINES = {
  lite: path.join(root, 'node_modules/stockfish/bin/stockfish-19-lite-single.js'),
  full: path.join(root, 'node_modules/stockfish/bin/stockfish-19-single.js'),
};

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

export interface SearchResult {
  bestmove: string;
  lines: PvLine[];
  /** First PV move of the principal line at each completed depth (index = depth). */
  depthMoves: string[];
}

export interface SearchOptions {
  depth?: number;
  movetime?: number;
  nodes?: number;
  multipv?: number;
  /** UCI moves to apply after the FEN. */
  moves?: string[];
  /** Restrict the search to these UCI moves. */
  searchmoves?: string[];
}

/** Converts a score to centipawns, mapping mates to ±(100000 - distance). */
export function scoreToCp(s: Score): number {
  if (s.mate !== undefined) {
    if (s.mate === 0) return -100000;
    return s.mate > 0 ? 100000 - s.mate * 100 : -100000 - s.mate * 100;
  }
  return s.cp ?? 0;
}

/** Lichess-style win percentage (0..100) for the side to move. */
export function winPercent(s: Score): number {
  if (s.mate !== undefined) return s.mate > 0 ? 100 : 0;
  const cp = Math.max(-1000, Math.min(1000, s.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export class UciEngine {
  private proc: ChildProcessWithoutNullStreams;
  private waiters: { pred: (l: string) => boolean; resolve: (l: string) => void; reject: (e: Error) => void }[] = [];
  private onLine: ((l: string) => void) | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  private constructor(variant: keyof typeof ENGINES) {
    this.proc = spawn(process.execPath, [ENGINES[variant]], { stdio: 'pipe' });
    const rl = createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => {
      if (line.includes('CRITICAL ERROR')) {
        // The engine refuses illegal positions and never answers; fail every pending wait.
        for (const w of this.waiters.splice(0)) w.reject(new Error(line));
        return;
      }
      this.onLine?.(line);
      const i = this.waiters.findIndex((w) => w.pred(line));
      if (i >= 0) {
        const [w] = this.waiters.splice(i, 1);
        w.resolve(line);
      }
    });
  }

  static async create(opts: { variant?: keyof typeof ENGINES; hashMb?: number } = {}): Promise<UciEngine> {
    const e = new UciEngine(opts.variant ?? 'lite');
    e.send('uci');
    await e.waitFor((l) => l === 'uciok');
    e.send(`setoption name Hash value ${opts.hashMb ?? 64}`);
    await e.ready();
    return e;
  }

  send(cmd: string) {
    this.proc.stdin.write(cmd + '\n');
  }

  private waitFor(pred: (l: string) => boolean): Promise<string> {
    return new Promise((resolve, reject) => this.waiters.push({ pred, resolve, reject }));
  }

  async ready() {
    this.send('isready');
    await this.waitFor((l) => l === 'readyok');
  }

  setOption(name: string, value: string | number | boolean) {
    this.send(`setoption name ${name} value ${value}`);
  }

  newGame() {
    this.send('ucinewgame');
  }

  /** Runs one search. Calls are serialized per engine instance. */
  analyze(fen: string, o: SearchOptions = {}): Promise<SearchResult> {
    const run = async () => {
      const multipv = o.multipv ?? 1;
      this.setOption('MultiPV', multipv);
      await this.ready();
      const byPv = new Map<number, PvLine>();
      const depthMoves: string[] = [];
      this.onLine = (line) => {
        if (!line.startsWith('info ') || !line.includes(' pv ')) return;
        const t = line.split(' ');
        const get = (k: string) => {
          const i = t.indexOf(k);
          return i >= 0 ? t[i + 1] : undefined;
        };
        if (t.includes('lowerbound') || t.includes('upperbound')) return;
        const depth = Number(get('depth'));
        const mpv = Number(get('multipv') ?? 1);
        const si = t.indexOf('score');
        const score: Score = t[si + 1] === 'mate' ? { mate: Number(t[si + 2]) } : { cp: Number(t[si + 2]) };
        const pv = t.slice(t.indexOf('pv') + 1);
        byPv.set(mpv, { multipv: mpv, depth, score, pv });
        if (mpv === 1) depthMoves[depth] = pv[0];
      };
      const pos = `position fen ${fen}` + (o.moves?.length ? ` moves ${o.moves.join(' ')}` : '');
      this.send(pos);
      let go = 'go';
      if (o.depth) go += ` depth ${o.depth}`;
      if (o.movetime) go += ` movetime ${o.movetime}`;
      if (o.nodes) go += ` nodes ${o.nodes}`;
      if (o.searchmoves?.length) go += ` searchmoves ${o.searchmoves.join(' ')}`;
      this.send(go);
      const done = await this.waitFor((l) => l.startsWith('bestmove'));
      this.onLine = null;
      const bestmove = done.split(' ')[1];
      const lines = [...byPv.values()].sort((a, b) => a.multipv - b.multipv);
      return { bestmove, lines, depthMoves };
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  quit() {
    this.send('quit');
    setTimeout(() => this.proc.kill(), 200).unref();
  }
}
