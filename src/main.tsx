import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent legacy code paths from persisting Obsidian credentials in plaintext.
// Secure config is handled by StorageManager; this compatibility guard can be
// removed once all legacy localStorage writes are deleted from App.tsx.
const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function(key: string, value: string) {
  if (key === 'obsidian_api_config') return;
  return originalSetItem.call(this, key, value);
};
localStorage.removeItem('obsidian_api_config');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
