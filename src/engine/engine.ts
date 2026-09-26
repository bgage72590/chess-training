// Browser client for Stockfish (WASM, single-threaded) running in a Web Worker.
// Searches are queued; each search sets its own options so play-strength limits never
// leak into analysis.
import { useSyncExternalStore } from 'react';
import BackupWorker from './fallback.worker.ts?worker&inline';
import { turnOf } from '../chess/utils';
import { goCommand, parseInfo, whitePov, type PvLine, type Score } from './score';

export { formatScore, scoreToCp, whitePov, winPercent, type PvLine, type Score } from './score';

export interface SearchResult {
  /** Best move in UCI, or null when the side to move has no legal move. */
  best: string | null;
  lines: PvLine[];
  /** Score of the principal line from White's point of view. */
  whiteScore?: Score;
}

export interface SearchOptions {
  depth?: number;
  movetime?: number;
  multipv?: number;
  /** Stockfish "Skill Level" 0..20 (weaker play). */
  skill?: number;
  /** Limit strength to an Elo (1320..3190). */
  elo?: number;
}

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface Job {
  fen: string;
  opts: SearchOptions;
  /** Resolves null when the search was cancelled. */
  resolve: (r: SearchResult | null) => void;
  cancelled: boolean;
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
      return;
    }
    if (line.startsWith('bestmove')) {
      const bestmove = line.split(' ')[1];
      const lines = [...this.lines.values()].sort((a, b) => a.multipv - b.multipv);
      this.current = null;
      job.resolve(
        job.cancelled
          ? null
          : {
              best: bestmove && bestmove !== '(none)' ? bestmove : null,
              lines,
              whiteScore: lines[0] && whitePov(lines[0].score, turnOf(job.fen)),
            },
      );
      this.next();
    }
  }

  private next() {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift()!;
    if (job.cancelled) {
      job.resolve(null);
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
    this.send(goCommand(o, 14));
  }

  /** Queues a search. Resolves null if cancelAll() runs before it finishes. */
  search(fen: string, opts: SearchOptions = {}): Promise<SearchResult | null> {
    return new Promise<SearchResult | null>((resolve, reject) => {
      const job: Job = { fen, opts, resolve, cancelled: false };
      this.queue.push(job);
      this.init().then(
        () => this.next(),
        (e) => {
          this.queue = this.queue.filter((j) => j !== job);
          reject(e);
        },
      );
    });
  }

  /** Stops the running search and drops queued ones; their promises resolve null. */
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
