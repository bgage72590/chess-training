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

setupInstall();
persistAfterProgress(subscribeProfile, () => getProfile().xp > 0);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void startCloudSync();
startSync();
