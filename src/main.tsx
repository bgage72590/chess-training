import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/board.css';
import './styles/pieces.css';
import './styles/app.css';
import './styles/pages.css';
import { App } from './App';
import { startCloudSync } from './store/cloud';
import { setupInstall } from './pwa/install';
import { startSync } from './sync';
import { armAudioUnlock } from './lib/audio';

setupInstall();
// The first tap, key press or VoiceOver activation starts the sound (Safari only allows it inside one).
armAudioUnlock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void startCloudSync();
startSync();
