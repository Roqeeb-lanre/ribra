import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { reloadForNewVersion } from './lib/staleBuild';
import './index.css';

// Vite fires this when a page's files from an older deploy can't be loaded.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
