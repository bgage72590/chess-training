// Sync codes identify one synced copy of a family's progress. 20 Crockford base32
// characters (100 random bits), shown in groups of four. Anyone with the code can read and
// change that copy, so it is treated like a password.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newSyncCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => ALPHABET[b & 31]).join('');
}

/** Accepts what people type or paste (any case, dashes, spaces, O for 0, I/L for 1). */
export function normalizeSyncCode(input: string): string | null {
  const s = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
  return /^[0-9A-HJKMNP-TV-Z]{20}$/.test(s) ? s : null;
}

export const formatSyncCode = (code: string) => code.match(/.{1,4}/g)!.join('-');

/** A link that opens the app and offers to link this device to the code. */
export function syncLink(code: string, base = `${location.origin}${location.pathname}`): string {
  return `${base}#/sync/${formatSyncCode(code)}`;
}
