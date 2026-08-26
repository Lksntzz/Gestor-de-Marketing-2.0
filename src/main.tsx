import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// One-time migration cleanup for pre-v0.1.4 plaintext configuration.
localStorage.removeItem('obsidian_api_config');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
