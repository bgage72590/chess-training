// Choosing a read-aloud voice that sounds like a person. Browsers list every system voice, and
// the first English one is often a novelty voice (macOS lists "Albert", "Bad News", "Bubbles",
// "Whisper", "Zarvox"... before "Samantha") or an old robotic one. This ranks the natural, neural
// and premium voices first and leaves the novelty voices out entirely.

/** What Pip says when a grown-up tries a voice (Grown-ups): recorded in every voice, so it lives here with
 *  the kid-side lines rather than in the grown-up screen, which scripts/voice/collect.ts leaves out. */
export const VOICE_PREVIEW = "Hi! I'm Pip. Let's play chess together!";

export interface VoiceLike {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
}

/** Joke voices (macOS) that should never read to a child. */
const NOVELTY =
  /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|princess)\b/i;
/** Old or formant voices that sound robotic (macOS MacinTalk and Eloquence, eSpeak, SAPI desktop). */
const ROBOTIC = /^(fred|junior|kathy|ralph|agnes|bruce|vicki|victoria|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b|espeak|^microsoft (david|zira|mark|hazel|george|susan)\b(?!.*natural)/i;
/** Apple's downloaded voices carry their tier in the voiceURI (com.apple.voice.premium.en-US.Zoe), and some system versions leave it out of the name. */
const PREMIUM_URI = /[._]premium\b/i;
const ENHANCED_URI = /[._]enhanced\b/i;
/** Good everyday voices (Apple and others) that are not tagged premium. */
const GOOD = /^(samantha|ava|zoe|allison|susan|karen|moira|tessa|serena|daniel|nicky|aaron|evan|joelle|noelle|nathan|tom|kate|oliver|jamie|matilda|fiona|veena|rishi)\b/i;

export const isEnglish = (v: VoiceLike) => /^en([-_]|$)/i.test(v.lang);
export const isNovelty = (v: VoiceLike) => NOVELTY.test(v.name);

/** Higher is more natural. Novelty voices score -Infinity. */
export function voiceScore(v: VoiceLike): number {
  const name = v.name;
  if (NOVELTY.test(name)) return -Infinity;
  let s = 40;
  if (/\b(natural|neural)\b/i.test(name)) s = 100;
  else if (/premium/i.test(name) || PREMIUM_URI.test(v.voiceURI)) s = 92;
  else if (/enhanced/i.test(name) || ENHANCED_URI.test(v.voiceURI)) s = 84;
  else if (/^google (us|uk) english/i.test(name)) s = 75;
  else if (GOOD.test(name)) s = 62;
  else if (ROBOTIC.test(name) || ROBOTIC.test(v.voiceURI)) s = 5;
  // Warm adult voices over the child-like neural ones, which can sound uncanny.
  if (s === 100 && /\b(ava|jenny|aria|emma|michelle|sonia|libby|natasha)\b/i.test(name)) s += 4;
  const lang = v.lang.replace('_', '-').toLowerCase();
  s += lang === 'en-us' ? 8 : lang === 'en-gb' ? 6 : /^en-(au|ie|ca|nz)$/.test(lang) ? 4 : 2;
  return s;
}

/** English voices, best first, without novelty voices. Online-only voices are left out when offline. */
export function rankVoices<T extends VoiceLike>(all: T[], online = true, avoid: ReadonlySet<string> = new Set()): T[] {
  return all
    .filter((v) => isEnglish(v) && !isNovelty(v) && (online || v.localService) && !avoid.has(v.voiceURI))
    .map((v, i) => ({ v, i, s: voiceScore(v) }))
    .sort((a, b) => b.s - a.s || Number(b.v.localService) - Number(a.v.localService) || a.i - b.i)
    .map((x) => x.v);
}

/** A short quality note for the grown-ups' voice list. */
export function voiceNote(v: VoiceLike): string {
  const s = voiceScore(v);
  const q = s >= 80 ? 'natural' : s >= 60 ? 'good' : s <= 20 ? 'robotic' : '';
  return [q, v.localService ? '' : 'online'].filter(Boolean).join(', ');
}
