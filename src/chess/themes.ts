import type { BoardTheme } from '../store/profile';

export interface BoardThemeInfo {
  id: BoardTheme;
  name: string;
  /**
   * What the Settings swatch shows: the light and dark square colors. Textured themes draw
   * their board image instead, from board.css (.swatch.board-<id> .swatch-squares), so the
   * image is referenced in one place only.
   */
  swatch: { light: string; dark: string; textured?: boolean };
}

/**
 * The board themes offered in Settings. The look itself is in board.css (.board-<id>);
 * textured themes draw a generated image (scripts/boards/generate.mjs) behind the squares.
 * Ids are stored in profiles, so never rename one.
 */
export const BOARD_THEMES: BoardThemeInfo[] = [
  { id: 'slate', name: 'Slate', swatch: { light: '#e2e8ec', dark: '#86a0b3' } },
  { id: 'walnut', name: 'Walnut', swatch: { light: '#e0bf8a', dark: '#73492a', textured: true } },
  { id: 'marble', name: 'Marble', swatch: { light: '#e8e4dc', dark: '#496858', textured: true } },
  { id: 'tourney', name: 'Tournament', swatch: { light: '#eeeed2', dark: '#769656' } },
  { id: 'ink', name: 'Ink', swatch: { light: '#d0d6df', dark: '#55637a' } },
  { id: 'rose', name: 'Rosewood', swatch: { light: '#f1e4dc', dark: '#b7847a' } },
];

/**
 * Inline CSS background for a theme's swatch: 2x2 plain squares. Undefined for textured
 * themes, whose swatch background comes from board.css (the swatch carries .board-<id>).
 */
export function swatchBackground(t: BoardThemeInfo): string | undefined {
  const { light, dark, textured } = t.swatch;
  if (textured) return undefined;
  return `conic-gradient(${dark} 0 25%, ${light} 0 50%, ${dark} 0 75%, ${light} 0) 0 0 / 100% 100%`;
}
