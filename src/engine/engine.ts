// Browser client for Stockfish (WASM, single-threaded) running in a Web Worker.
// Searches are queued; each search sets its own options so play-strength limits never
// leak into analysis.
import { useSyncExternalStore } from 'react';
import BackupWorker from './fallback.worker.ts?worker&inline';

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
}

export interface SearchOptions {
  depth?: number;
  movetime?: number;
  nodes?: number;
  multipv?: number;
  searchmoves?: string[];
  /** Stockfish "Skill Level" 0..20 (weaker play). */
  skill?: number;
  /** Limit strength to an Elo (1320..3190). */
  elo?: number;
  onUpdate?: (lines: PvLine[]) => void;
}

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface Job {
  fen: string;
  opts: SearchOptions;
  resolve: (r: SearchResult) => void;
  cancelled: boolean;
}

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

class Engine {
  status: EngineStatus = 'idle';
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private current: Job | null = null;
  private lines = new Map<number, PvLine>();
  private waiters: { pred: (l: string) => boolean; resolve: () => void }[] = [];
  private listeners = new Set<() => void>();

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private setStatus(s: EngineStatus) {
    this.status = s;
    this.listeners.forEach((l) => l());
  }

  /** Which engine is running: Stockfish (WASM) or the pure-JS backup. */
  kind: 'stockfish' | 'backup' | null = null;

  init(): Promise<void> {
    if (this.ready) return this.ready;
    this.setStatus('loading');
    const first = probeWasm().then(() => this.start('stockfish'));
    this.ready = first
      .catch(() => this.start('backup'))
      .then(
        () => this.setStatus('ready'),
        (e) => {
          this.setStatus('failed');
          throw e;
        },
      );
    this.ready.catch(() => undefined);
    return this.ready;
  }

  private start(kind: 'stockfish' | 'backup'): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let w: Worker;
      try {
        w = kind === 'stockfish' ? new Worker(new URL('engine/stockfish.js', document.baseURI).href) : new BackupWorker();
      } catch (e) {
        reject(e);
        return;
      }
      const fail = (err: Error) => {
        clearTimeout(timer);
        w.terminate();
        this.worker = null;
        this.waiters = [];
        reject(err);
      };
      const timer = setTimeout(() => fail(new Error(`${kind} did not start`)), kind === 'stockfish' ? 12000 : 8000);
      this.worker = w;
      this.kind = kind;
      w.onmessage = (e: MessageEvent) => this.onLine(String(e.data));
      w.onerror = (e) => fail(new Error(e.message || `${kind} failed to load`));
      this.send('uci');
      this.wait((l) => l === 'uciok')
        .then(() => {
          this.send('setoption name Hash value 32');
          this.send('isready');
          return this.wait((l) => l === 'readyok');
        })
        .then(() => {
          clearTimeout(timer);
          w.onerror = () => this.setStatus('failed');
          resolve();
        });
    });
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private wait(pred: (l: string) => boolean): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ pred, resolve }));
  }

  private onLine(line: string) {
    const i = this.waiters.findIndex((w) => w.pred(line));
    if (i >= 0) this.waiters.splice(i, 1)[0].resolve();
    const job = this.current;
    if (!job) return;
    const info = parseInfo(line);
    if (info) {
      this.lines.set(info.multipv, info);
      if (!job.cancelled && info.multipv === (job.opts.multipv ?? 1)) {
        job.opts.onUpdate?.([...this.lines.values()].sort((a, b) => a.multipv - b.multipv));
      }
      return;
    }
    if (line.startsWith('bestmove')) {
      const result: SearchResult = {
        bestmove: line.split(' ')[1],
        lines: [...this.lines.values()].sort((a, b) => a.multipv - b.multipv),
      };
      this.current = null;
      job.resolve(result);
      this.next();
    }
  }

  private next() {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift()!;
    if (job.cancelled) {
      job.resolve({ bestmove: '', lines: [] });
      this.next();
      return;
    }
    this.current = job;
    this.lines.clear();
    const o = job.opts;
    this.send(`setoption name MultiPV value ${o.multipv ?? 1}`);
    if (o.elo) {
      this.send('setoption name Skill Level value 20');
      this.send('setoption name UCI_LimitStrength value true');
      this.send(`setoption name UCI_Elo value ${Math.max(1320, Math.min(3190, Math.round(o.elo)))}`);
    } else {
      this.send('setoption name UCI_LimitStrength value false');
      this.send(`setoption name Skill Level value ${o.skill ?? 20}`);
    }
    this.send(`position fen ${job.fen}`);
    let go = 'go';
    if (o.depth) go += ` depth ${o.depth}`;
    if (o.movetime) go += ` movetime ${o.movetime}`;
    if (o.nodes) go += ` nodes ${o.nodes}`;
    if (!o.depth && !o.movetime && !o.nodes) go += ' depth 14';
    if (o.searchmoves?.length) go += ` searchmoves ${o.searchmoves.join(' ')}`;
    this.send(go);
  }

  async search(fen: string, opts: SearchOptions = {}): Promise<SearchResult> {
    await this.init();
    return new Promise<SearchResult>((resolve) => {
      this.queue.push({ fen, opts, resolve, cancelled: false });
      this.next();
    });
  }

  /** Stops the running search (it resolves with what it has) and drops queued ones. */
  cancelAll() {
    for (const j of this.queue) j.cancelled = true;
    if (this.current) {
      this.current.cancelled = true;
      this.send('stop');
    }
  }

  newGame() {
    this.send('ucinewgame');
  }
}

/**
 * Fails fast when Stockfish cannot run here: no WebAssembly, a page policy that forbids
 * compiling it, or an engine file that cannot be fetched. Stockfish's loader swallows
 * these errors inside its worker, so without this check we would only notice on timeout.
 */
async function probeWasm() {
  if (typeof WebAssembly !== 'object') throw new Error('no WebAssembly');
  await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
  const res = await fetch(new URL('engine/stockfish.wasm', document.baseURI).href, { method: 'HEAD' });
  if (res.status === 404 || res.status >= 500) throw new Error(`engine file unavailable (${res.status})`);
}

export const engine = new Engine();

export function useEngineStatus(): EngineStatus {
  return useSyncExternalStore(engine.subscribe, () => engine.status, () => engine.status);
}

/** Lichess-style win percentage (0..100) for the side the score belongs to. */
export function winPercent(s: Score | undefined): number {
  if (!s) return 50;
  if (s.mate !== undefined) return s.mate > 0 ? 100 : s.mate < 0 ? 0 : 0;
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
