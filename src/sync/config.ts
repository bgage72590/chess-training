// Where synced progress is stored: a Supabase project exposing the sync_get / sync_put /
// sync_delete functions from docs/sync.sql. Both values are public by design (the database
// only allows those functions, and each copy is reachable only with its sync code).
// VITE_SYNC_URL / VITE_SYNC_KEY override them at build time (e.g. a local test server);
// setting VITE_SYNC_URL to an empty string hides cross-device sync.
export const SYNC_URL: string = import.meta.env.VITE_SYNC_URL ?? 'https://nspynmewkbydggfmatcw.supabase.co';
export const SYNC_KEY: string = import.meta.env.VITE_SYNC_KEY ?? 'sb_publishable_KIWDaVgswYcbc3Lvf5cNfQ_ylQcDVKk';
