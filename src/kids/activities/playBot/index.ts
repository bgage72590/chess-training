import type { ActivityDef } from '../types';
import { PlayBot } from './PlayBot';
import { validatePlayBot, type PlayBotItem } from './logic';

export { PlayBot };
export type { PlayBotItem } from './logic';

export const playBotActivity: ActivityDef<PlayBotItem> = {
  id: 'play-bot',
  title: 'Play a Buddy',
  icon: 'swords',
  Component: PlayBot,
  validate: validatePlayBot,
  game: true,
};
