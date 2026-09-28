// A random id for this browser, so each device's counters stay apart in a synced copy (tally.ts).
// Kept in its own storage key: it is never synced, exported or reset.
const KEY = 'tempo.device.v1';
let id: string | null = null;

export function deviceId(): string {
  if (id) return id;
  try {
    id = localStorage.getItem(KEY);
    if (!id) localStorage.setItem(KEY, (id = newId()));
  } catch {
    id = newId(); // storage unavailable: one id for this page load
  }
  return id;
}

function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('');
}
