// Minimal UCI client that runs the Stockfish WASM build under Node as a child process.
// Used by the content validator and the puzzle generator.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { goCommand, parseInfo, type PvLine } from '../../src/engine/score.ts';

export { scoreToCp, winPercent, type PvLine, type Score } from '../../src/engine/score.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINES = {
  lite: path.join(root, 'node_modules/stockfish/bin/stockfish-19-lite-single.js'),
  full: path.join(root, 'node_modules/stockfish/bin/stockfish-19-single.js'),
};

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

export class UciEngine {
  private proc: ChildProcessWithoutNullStreams;
  private waiters: { pred: (l: string) => boolean; resolve: (l: string) => void; reject: (e: Error) => void }[] = [];
  private onLine: ((l: string) => void) | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  /**
   * Clear the hash before every search so results do not depend on earlier searches. This
   * costs hash reuse between searches of the same position; the validator accepts that so its
   * verdicts are the same whichever checks run first.
   */
  private fresh = false;

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

  static async create(opts: { variant?: keyof typeof ENGINES; hashMb?: number; fresh?: boolean } = {}): Promise<UciEngine> {
    const e = new UciEngine(opts.variant ?? 'lite');
    e.fresh = opts.fresh ?? false;
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
      if (this.fresh) this.newGame();
      this.setOption('MultiPV', o.multipv ?? 1);
      await this.ready();
      const byPv = new Map<number, PvLine>();
      const depthMoves: string[] = [];
      this.onLine = (line) => {
        const info = parseInfo(line);
        if (!info) return;
        byPv.set(info.multipv, info);
        if (info.multipv === 1) depthMoves[info.depth] = info.pv[0];
      };
      this.send(`position fen ${fen}` + (o.moves?.length ? ` moves ${o.moves.join(' ')}` : ''));
      this.send(goCommand(o));
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
