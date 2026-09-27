import type { BoardTheme } from '../store/profile';
import walnutBoard from '../assets/boards/walnut.webp';
import marbleBoard from '../assets/boards/marble.webp';

export interface BoardThemeInfo {
  id: BoardTheme;
  name: string;
  /**
   * What the Settings swatch shows: the light and dark square colors, and for textured
   * themes the board image (its top-left 2x2 squares are shown: light, dark / dark, light).
   */
  swatch: { light: string; dark: string; image?: string };
}

/**
 * The board themes offered in Settings. The look itself is in board.css (.board-<id>);
 * textured themes draw a generated image (scripts/boards/generate.mjs) behind the squares.
 * Ids are stored in profiles, so never rename one.
 */
export const BOARD_THEMES: BoardThemeInfo[] = [
  { id: 'slate', name: 'Slate', swatch: { light: '#e2e8ec', dark: '#86a0b3' } },
  { id: 'walnut', name: 'Walnut', swatch: { light: '#e6cb9a', dark: '#7d5130', image: walnutBoard } },
  { id: 'marble', name: 'Marble', swatch: { light: '#ece7de', dark: '#5d7469', image: marbleBoard } },
  { id: 'tourney', name: 'Tournament', swatch: { light: '#eeeed2', dark: '#769656' } },
  { id: 'ink', name: 'Ink', swatch: { light: '#d0d6df', dark: '#55637a' } },
  { id: 'rose', name: 'Rosewood', swatch: { light: '#f1e4dc', dark: '#b7847a' } },
];

/** CSS background for a theme's swatch: 2x2 squares of the board image, or plain colors. */
export function swatchBackground(t: BoardThemeInfo): string {
  const { light, dark, image } = t.swatch;
  if (image) return `url(${image}) 0 0 / 400% 400% no-repeat, ${light}`;
  return `conic-gradient(${dark} 0 25%, ${light} 0 50%, ${dark} 0 75%, ${light} 0) 0 0 / 100% 100%`;
}
