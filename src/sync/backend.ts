// Storage for synced copies. The app talks to it only through three database functions,
// so it needs no accounts: a copy is addressed by its sync code (stored hashed).

export interface SyncSlot {
  data: unknown;
  version: number;
}

export type PutResult = { ok: true; version: number } | { ok: false };

export interface SyncBackend {
  get(code: string): Promise<SyncSlot | null>;
  /** Writes only if the stored version still equals baseVersion (0 = create). */
  put(code: string, data: unknown, baseVersion: number): Promise<PutResult>;
  remove(code: string): Promise<void>;
}

/** Supabase REST (PostgREST) calls to the functions in docs/sync.sql. */
export function supabaseBackend(url: string, key: string): SyncBackend {
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  // Legacy anon keys are JWTs and also go in Authorization; new publishable keys must not.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const rpc = async <T>(fn: string, body: unknown): Promise<T> => {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`sync ${fn} failed (${res.status})`);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  };
  return {
    get: (code) => rpc<SyncSlot | null>('sync_get', { code }),
    put: (code, data, baseVersion) => rpc<PutResult>('sync_put', { code, data, base_version: baseVersion }),
    remove: async (code) => void (await rpc('sync_delete', { code })),
  };
}

/** An in-memory backend for tests. */
export function memoryBackend(): SyncBackend & { slots: Map<string, SyncSlot> } {
  const slots = new Map<string, SyncSlot>();
  return {
    slots,
    get: async (code) => structuredClone(slots.get(code) ?? null),
    put: async (code, data, baseVersion) => {
      const cur = slots.get(code);
      if ((cur?.version ?? 0) !== baseVersion) return { ok: false };
      const version = baseVersion + 1;
      slots.set(code, { data: structuredClone(data), version });
      return { ok: true, version };
    },
    remove: async (code) => void slots.delete(code),
  };
}
