// Pawn Buddy wardrobe: colors and faces are free; hats unlock by stars (deterministic, shown in advance).
// Step 0 ships 8 colors, 6 faces and the first 4 hats; the crown is reserved for graduation.

export type AvatarColor = 'sun' | 'coral' | 'grass' | 'sea' | 'berry' | 'sky' | 'cream' | 'plum';
export type FaceId = 'smile' | 'grin' | 'wow' | 'wink' | 'calm' | 'cool';
export type HatId = 'red-scarf' | 'blue-cap' | 'pirate-hat' | 'flower-band' | 'crown';

export const AVATAR_COLORS: Record<AvatarColor, { fill: string; shade: string; label: string }> = {
  sun: { fill: '#ffc83d', shade: '#e0a100', label: 'Sun' },
  coral: { fill: '#ff9f7f', shade: '#e0734f', label: 'Coral' },
  grass: { fill: '#9ad48f', shade: '#5fa55a', label: 'Grass' },
  sea: { fill: '#7ab0e0', shade: '#4a86bd', label: 'Sea' },
  berry: { fill: '#c9b3ff', shade: '#9a7fe6', label: 'Berry' },
  sky: { fill: '#9fd3ff', shade: '#62a9e0', label: 'Sky' },
  cream: { fill: '#fff3d6', shade: '#e6d2a4', label: 'Cream' },
  plum: { fill: '#b98ccc', shade: '#9b6fb0', label: 'Plum' },
};

export const FACES: { id: FaceId; label: string }[] = [
  { id: 'smile', label: 'Smile' },
  { id: 'grin', label: 'Big grin' },
  { id: 'wow', label: 'Wow' },
  { id: 'wink', label: 'Wink' },
  { id: 'calm', label: 'Calm' },
  { id: 'cool', label: 'Cool' },
];

export interface HatDef {
  id: HatId;
  label: string;
  /** Total stars needed; undefined = special unlock. */
  stars?: number;
  how: string;
}

export const HATS: HatDef[] = [
  { id: 'red-scarf', label: 'Red scarf', stars: 10, how: 'Earn 10 stars' },
  { id: 'blue-cap', label: 'Blue cap', stars: 25, how: 'Earn 25 stars' },
  { id: 'pirate-hat', label: 'Pirate hat', stars: 50, how: 'Earn 50 stars' },
  { id: 'flower-band', label: 'Flower band', stars: 80, how: 'Earn 80 stars' },
  { id: 'crown', label: 'Crown', how: 'Reach the top of Crown Tower' },
];

export const HAT_BY_ID = new Map(HATS.map((h) => [h.id, h]));

/** Hats unlocked by a star total. */
export const hatsForStars = (stars: number): HatId[] => HATS.filter((h) => h.stars != null && stars >= h.stars).map((h) => h.id);

/** A few fun names for kids who skip typing a name. */
export const FUN_NAMES = ['Brave Otter', 'Happy Panda', 'Zippy Fox', 'Sunny Bee', 'Clever Owl', 'Jolly Frog', 'Rocket Cat', 'Tiny Tiger', 'Lucky Duck', 'Bouncy Bear', 'Star Mouse', 'Cozy Koala'];
