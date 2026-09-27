// Pip's recorded voice: each spoken line has a pre-rendered clip named by a hash of the exact text
// the speech engine would say (after pronounce()). Shared by the app and scripts/voice.
import { pronounce } from './pronounce';

/** The text a caption is spoken as, with whitespace tidied. */
export const spokenText = (caption: string) => pronounce(caption).replace(/\s+/g, ' ').trim();

/** A 64-bit hash (two 32-bit halves, base 36) naming a line's clip. */
export function clipKey(spoken: string): string {
  let a = 0x811c9dc5;
  let b = 5381;
  for (let i = 0; i < spoken.length; i++) {
    const c = spoken.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = (Math.imul(b, 33) + c) >>> 0;
  }
  return a.toString(36).padStart(7, '0') + b.toString(36).padStart(7, '0');
}
