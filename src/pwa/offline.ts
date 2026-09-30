// Whether Tempo is saved for offline use. The service worker saves every app file when it installs;
// this asks it what it holds, and says what the person should do if it is not all there yet.

export type OfflineState =
  /** Every file of the running version is saved. */
  | 'ready'
  /** The worker has not (yet) taken control of this page or has not finished saving: reload once. */
  | 'reload'
  /** Not the installed build (development, the single-file copy) or a browser without service workers. */
  | 'unavailable';

export interface WorkerStatus {
  version: string;
  files: number;
  missing: number;
}

/** What the person sees, from what the worker said (null: it did not answer). */
export function offlineState(controlled: boolean, status: WorkerStatus | null): OfflineState {
  if (!controlled || !status) return 'reload';
  return status.missing === 0 && status.files > 0 ? 'ready' : 'reload';
}

/** True when the browser has no worker for Tempo at all (a private window, blocked site data): reloading would not help. */
export const workerBlocked = (controlled: boolean, registered: boolean) => !controlled && !registered;

/** Asks the worker in control of this page for its status; null when there is none or it does not answer in time. */
export function askWorker(container: Pick<ServiceWorkerContainer, 'controller'>, timeoutMs = 4000): Promise<WorkerStatus | null> {
  const worker = container.controller;
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const t = setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (e: MessageEvent) => {
      clearTimeout(t);
      const m = e.data as { type?: string } & Partial<WorkerStatus>;
      resolve(m?.type === 'status' && typeof m.files === 'number' && typeof m.missing === 'number' ? { version: String(m.version ?? ''), files: m.files, missing: m.missing } : null);
    };
    try {
      worker.postMessage({ type: 'status' }, [channel.port2]);
    } catch {
      clearTimeout(t);
      resolve(null);
    }
  });
}

/** Whether this build has an offline copy to report on at all. */
export const offlineSupported = () => import.meta.env.PROD && import.meta.env.MODE !== 'single' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
