// Every sticker and trophy: ids, titles, facts, art specs and trophy predicates (spec section 6).
import type { AgeBand, PieceCode } from '../activities/types';
import type { KidsIconName } from '../ui/KidsIcon';
import { NODES, WORLD_BY_ID, type WorldId } from './worlds';
import { BUDDIES, BAND_LADDER, type BuddyId } from './buddies';

export interface StickerDef {
  id: string;
  title: string;
  fact: string;
  /** World page (node stickers) or 'special'. */
  page: WorldId | 'special';
  shiny?: boolean;
  art: { icon?: KidsIconName; piece?: PieceCode; color: string };
  /** For node stickers: the node that grants it. */
  node?: string;
}

const nodeStickers: StickerDef[] = NODES.map((n) => ({
  id: `s-${n.id}`,
  title: n.title,
  fact: n.fact,
  page: n.world,
  shiny: !!n.boss,
  node: n.id,
  art: { piece: n.piece, icon: n.piece ? undefined : n.boss ? 'castle' : 'star', color: WORLD_BY_ID.get(n.world)!.accent },
}));

const moment = (id: string, title: string, fact: string, icon: KidsIconName, color: string): StickerDef => ({ id, title, fact, page: 'special', art: { icon, color } });

export const MOMENT_STICKERS: StickerDef[] = [
  moment('st-first-capture', 'First capture', 'Your first capture! Chomp!', 'candy', '#e0734f'),
  moment('st-first-check', 'First check', 'Your first check! The king felt the lava.', 'flame', '#5a63c9'),
  moment('st-first-mate', 'First checkmate', 'Your first checkmate! The king had nowhere to go.', 'crown', '#b07a12'),
  moment('st-en-passant', 'Sneaky pawn', 'You did the en passant trick!', 'eye', '#c18a00'),
  moment('st-castle', 'Castle builder', 'You castled your king to safety!', 'castle', '#3f86c6'),
  moment('st-promotion', 'Pawn to queen', 'Your pawn became a queen!', 'crown', '#9a7fe6'),
  moment('st-knight-trek', 'Knight trek', 'Corner to corner with a knight!', 'flag', '#a86b2d'),
  moment('st-surprise-knight', 'Surprise knight', 'You made a knight with check. Surprise!', 'gift', '#a86b2d'),
  moment('st-pawn-war-win', 'Pawn War winner', 'You won a Pawn War!', 'swords', '#c18a00'),
  moment('st-crown-captured', 'Crown captured', 'You captured the crown!', 'crown', '#1f8a84'),
  moment('st-ladder-mate', 'Ladder mate', 'Two rooks climbed the ladder to checkmate!', 'road', '#3f86c6'),
  moment('st-brave-try', 'Brave try', 'You kept trying, even when it was tricky. That is brave!', 'heart', '#e0734f'),
  moment('st-friend-game', 'Friend game', 'You played chess with a friend!', 'heart', '#3f8f4f'),
];

export const STICKERS: StickerDef[] = [...nodeStickers, ...MOMENT_STICKERS];
const STICKER_BY_ID = new Map(STICKERS.map((s) => [s.id, s]));

/** Garden and family stickers are numbered: st-garden-<n>, st-family-<n>. */
export function stickerDef(id: string): StickerDef | undefined {
  const known = STICKER_BY_ID.get(id);
  if (known) return known;
  const garden = /^st-garden-(\d+)$/.exec(id);
  if (garden) return { id, title: `Garden ${garden[1]}`, fact: `You filled garden strip number ${garden[1]}!`, page: 'special', art: { icon: 'leaf', color: '#5fa55a' } };
  const fam = /^st-family-(\d+)$/.exec(id);
  if (fam) return { id, title: `Family party ${fam[1]}`, fact: 'Your family filled the star jar together!', page: 'special', art: { icon: 'gift', color: '#d99a00' } };
  return undefined;
}

export const isKnownSticker = (id: string) => !!stickerDef(id) || !!TROPHY_BY_ID.get(id);

// ---------- Trophies ----------

export interface TrophySummary {
  band: AgeBand;
  totalStars: number;
  goldCrowns: number;
  stickers: Record<string, number>;
  bots: Partial<Record<BuddyId, { w: number; d: number; l: number }>>;
  bests: Record<string, number>;
  graduated: boolean;
}

export interface TrophyDef {
  id: string;
  title: string;
  icon: KidsIconName;
  color: string;
  /** Shown under a locked trophy. */
  how: string;
  test?(s: TrophySummary): boolean;
}

const beat = (b: BuddyId) => (s: TrophySummary) => (s.bots[b]?.w ?? 0) > 0;

export const TROPHIES: TrophyDef[] = [
  { id: 'tr-first-mate', title: 'First Checkmate', icon: 'crown', color: '#b07a12', how: 'Give checkmate', test: (s) => !!s.stickers['st-first-mate'] },
  { id: 'tr-pawn-war', title: 'Pawn War Winner', icon: 'swords', color: '#c18a00', how: 'Win a Pawn War', test: (s) => !!s.stickers['st-pawn-war-win'] },
  { id: 'tr-castle', title: 'Castle Builder', icon: 'castle', color: '#3f86c6', how: 'Castle your king', test: (s) => !!s.stickers['st-castle'] },
  { id: 'tr-en-passant', title: 'En Passant Expert', icon: 'eye', color: '#c18a00', how: 'Do the sneaky pawn trick', test: (s) => !!s.stickers['st-en-passant'] },
  { id: 'tr-knight-trek', title: 'Knight Trekker', icon: 'flag', color: '#a86b2d', how: 'Hop a knight from corner to corner', test: (s) => !!s.stickers['st-knight-trek'] },
  { id: 'tr-ladder', title: 'Ladder Mate', icon: 'road', color: '#3f86c6', how: 'Checkmate with two rooks', test: (s) => !!s.stickers['st-ladder-mate'] },
  { id: 'tr-box', title: 'Box Mate', icon: 'shield', color: '#9a7fe6', how: 'Checkmate with king and queen' },
  { id: 'tr-forks', title: 'Fork Finder', icon: 'puzzle', color: '#1f8a84', how: 'Solve 10 forks', test: (s) => (s.bests['forks-solved'] ?? 0) >= 10 },
  ...(Object.keys(BUDDIES) as BuddyId[]).filter((b) => !BUDDIES[b].optional).map((b) => ({ id: `tr-beat-${b}`, title: `Beat ${BUDDIES[b].name}`, icon: 'trophy' as KidsIconName, color: BUDDIES[b].color, how: `Win a game against ${BUDDIES[b].name}`, test: beat(b) })),
  { id: 'tr-beat-all', title: 'Beat all my buddies', icon: 'trophy', color: '#d99a00', how: 'Beat every buddy on your ladder', test: (s) => BAND_LADDER[s.band].every((b) => (s.bots[b]?.w ?? 0) > 0) },
  { id: 'tr-stars-50', title: '50 stars', icon: 'star', color: '#d99a00', how: 'Collect 50 stars', test: (s) => s.totalStars >= 50 },
  { id: 'tr-stars-100', title: '100 stars', icon: 'star', color: '#d99a00', how: 'Collect 100 stars', test: (s) => s.totalStars >= 100 },
  { id: 'tr-stars-250', title: '250 stars', icon: 'star', color: '#d99a00', how: 'Collect 250 stars', test: (s) => s.totalStars >= 250 },
  { id: 'tr-gold-1', title: 'Gold crown', icon: 'crown', color: '#d99a00', how: 'Earn a gold crown on a Rank', test: (s) => s.goldCrowns >= 1 },
  { id: 'tr-gold-4', title: '4 gold crowns', icon: 'crown', color: '#d99a00', how: 'Earn 4 gold crowns', test: (s) => s.goldCrowns >= 4 },
  { id: 'tr-gold-8', title: '8 gold crowns', icon: 'crown', color: '#d99a00', how: 'Earn gold crowns on all 8 Ranks', test: (s) => s.goldCrowns >= 8 },
  { id: 'tr-graduate', title: 'Graduate', icon: 'crown', color: '#b07a12', how: 'Reach the top of Crown Tower', test: (s) => s.graduated },
];

export const TROPHY_BY_ID = new Map(TROPHIES.map((t) => [t.id, t]));

/** Trophies a band can see (buddy trophies only for the band ladder). */
export function trophiesFor(band: AgeBand): TrophyDef[] {
  return TROPHIES.filter((t) => {
    const m = /^tr-beat-(\w+)$/.exec(t.id);
    if (!m || m[1] === 'all') return true;
    return BAND_LADDER[band].includes(m[1] as BuddyId);
  });
}
