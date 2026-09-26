import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/pieces.css';
import './styles/app.css';
import './styles/pages.css';
import { App } from './App';
import { startCloudSync } from './store/cloud';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void startCloudSync();
