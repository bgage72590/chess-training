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
import { persistAfterProgress } from './lib/storage';
import { getProfile, subscribeProfile } from './store/profile';
import { startSync } from './sync';
import { armAudioUnlock } from './lib/audio';
import { navigate } from './router';

setupInstall();
// The native smoke build (CI) opens the diagnostics page: src/native/diagnostics.ts.
if (import.meta.env.MODE === 'native' && import.meta.env.VITE_NATIVE_SMOKE) navigate('diag', { replace: true });
// The first tap, key press or VoiceOver activation starts the sound (Safari only allows it inside one).
armAudioUnlock();
persistAfterProgress(subscribeProfile, () => getProfile().xp > 0);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void startCloudSync();
startSync();
