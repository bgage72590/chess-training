// Contracts between the Kids framework (player, registry, store) and activities / packs.
// Packs use these read-only. See the Kids spec, section 11.3.
import type { ComponentType, ReactNode } from 'react';
import type { SquareTone } from '../../chess/Board'; // 'good' | 'bad' | 'hint' | 'focus'
import type { KidProfile } from '../store/kidsStore';
import type { BandTuning } from '../curriculum/tuning';
import type { KidsIconName } from '../ui/KidsIcon';
import type { PipMood } from '../ui/Pip';
import type { KidSound } from '../lib/kidsSound';

export type { SquareTone };
export type AgeBand = 'sprout' | 'explorer' | 'champion';
export type Tier = 1 | 2 | 3;
export type Sq = string; // 'a1'..'h8'
export type PieceCode = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export type Placement = Partial<Record<Sq, PieceCode>>;
export type BandText = string | ({ all: string } & Partial<Record<AgeBand, string>>);
export interface Arrow {
  from: Sq;
  to: Sq;
  color?: 'green' | 'red' | 'blue' | 'yellow';
}
export type ArtKey =
  | 'star'
  | 'rock'
  | 'lava'
  | 'statue-eyes'
  | 'cloud'
  | `candy:${1 | 3 | 5 | 9}`
  | 'footprints'
  | `splat:${0 | 1 | 2 | 3 | 4 | 5}`
  | 'check'
  | 'target'
  | 'danger'
  | 'dot'
  | `ghost:${PieceCode}`;

/** Fields any item may carry; the player reads these, activities ignore them. */
export interface ItemMeta {
  id?: string; // stable id; default `${setId}#${index}` (append-only authoring)
  tier?: Tier; // default 1
  bands?: AgeBand[]; // default all
  tune?: Partial<Record<AgeBand, Record<string, unknown>>>; // per-band overrides merged over the item
  superTune?: Record<string, unknown>; // "Super Star" variant (golden star)
  ease?: Record<string, unknown>[]; // game items: successively easier variants (5.3)
  say?: BandText; // instruction line at item start
  rule?: BandText; // hint level 1 line
}
export interface HintStep {
  /** One line, or several spoken one after another (each can then have its own recording). */
  say?: BandText | BandText[];
  tones?: Record<Sq, SquareTone>;
  arrows?: Arrow[];
  art?: Record<Sq, ArtKey>;
  demo?: string[] /* uci */;
}
export interface ItemResult {
  score: 1 | 2 | 3;
  mistakes: number;
  hintLevel: 0 | 1 | 2 | 3 | 4;
  golden?: boolean;
  outcome?: 'win' | 'draw' | 'loss';
  stats?: Record<string, number>;
}
export type PlayMode = 'node' | 'warmup' | 'placement' | 'playground';
export interface TrayButton {
  id: string;
  label: BandText;
  icon?: KidsIconName;
  art?: ReactNode;
  /** Shown like a button but only informs (the candy jar): no focus, no press, read out by `ariaLabel`. */
  inert?: boolean;
  ariaLabel?: string;
  variant?: 'primary' | 'go' | 'info' | 'boss' | 'magic' | 'plain';
  disabled?: boolean;
  onPress(): void;
}
export interface PlayerApi {
  readonly band: AgeBand;
  readonly tuning: BandTuning;
  readonly kid: KidProfile;
  readonly mode: PlayMode;
  say(text: BandText | BandText[], mood?: PipMood): void; // bubble + speech per band voice rules
  mistake(text?: BandText | BandText[]): void; // counts a mistake; boop; Pip 'oops'; advances hint ladder; may offer "Easier one?"
  setHints(steps: HintStep[]): void; // ladder levels 1..4 for the current item (missing levels use generic fallbacks)
  readonly hint: HintStep | null; // currently shown hint step (activity renders tones/arrows/art from it)
  readonly hintLevel: 0 | 1 | 2 | 3 | 4;
  progress(done: number, total: number): void; // small counter chip in the top bar (e.g. stars 2/3)
  par?(used: number, par: number): void; // footprints in the top bar (Explorer and Champion star items)
  celebrate(kind: 'small' | 'big' | 'checkmate' | 'promotion'): void;
  sound(name: KidSound): void;
  award(id: string): void; // sticker or trophy id declared in curriculum/stickers.ts; idempotent
  setTray(buttons: TrayButton[] | null): void;
  rng(): number; // seeded per run
  best(key: string, value: number, better: 'higher' | 'lower'): boolean; // personal bests; true if improved
  puzzle: { rating: number; isSeen(id: string): boolean; report(id: string, rating: number, ok: boolean): void };
  engineReady(): boolean; // engine.status === 'ready'
  opponent?: { kind: 'bot' } | { kind: 'friend'; kidId: string | null }; // playground friend mode
}
export interface ActivityProps<I> {
  item: I & ItemMeta; // already resolved: tune/superTune/ease merged
  itemKey: string; // remount key
  band: AgeBand;
  kid: KidProfile;
  player: PlayerApi;
  onDone(r: ItemResult): void;
}
export interface ActivityDef<I = unknown> {
  id: string;
  title: string;
  icon: KidsIconName;
  Component: ComponentType<ActivityProps<I>>;
  validate(item: I & ItemMeta, band: AgeBand): string[]; // MANDATORY; [] means valid
  review?(rng: () => number, band: AgeBand): I; // endless / warm-up generator; output must validate
  game?: boolean; // one item per run; outcome-based scoring; ease ladder
}
export interface IntroStep {
  say: BandText;
  fen?: string;
  pieces?: Placement;
  art?: Partial<Record<Sq, ArtKey>>;
  arrows?: Arrow[];
  tones?: Partial<Record<Sq, SquareTone>>;
  move?: [Sq, Sq];
  ms?: number; // default 1800 ms after speech
  pick?: { answer: PieceCode; options: PieceCode[] }; // "Piece Parade" picture quiz (unscored)
}
export interface LevelSet<I = unknown> {
  id: string; // == node id (or cp1..cp8)
  activity: string;
  intro?: IntroStep[]; // "Watch Pip"; plays on the node's first open; replay = hint level 1
  items: (I & ItemMeta)[];
  perRun?: Partial<Record<AgeBand, number>>;
  order?: 'fixed' | 'tiered-shuffle'; // default 'tiered-shuffle'; game sets use 'fixed'
}
export interface PlaygroundEntry {
  id: string;
  title: BandText;
  icon: KidsIconName;
  activity: string;
  item: unknown;
  bands?: AgeBand[];
  unlock?: { node?: string; stars?: number };
  friend?: boolean;
}
export interface KidsPack {
  id: 'core' | 'movement' | 'minigames' | 'rules' | 'buddies' | 'tactics';
  activities: ActivityDef<any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  levelSets: LevelSet<any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  playground?: PlaygroundEntry[];
}

/** The text of a BandText for a band. */
export function bandText(t: BandText | undefined, band: AgeBand): string {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  return t[band] ?? t.all;
}

/** The standard item score (3.3): 3 = no mistakes and hint level 1 or less; 2 = 2 or fewer mistakes
 *  (or hint level 2); 1 = completed with more help. */
export function standardScore(mistakes: number, hintLevel: number): 1 | 2 | 3 {
  if (hintLevel >= 3) return 1;
  if (mistakes === 0 && hintLevel <= 1) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}
