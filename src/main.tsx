import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign development WebSocket and Vite HMR errors in the browser console/overlay
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('WS ') || msg.includes('HMR')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('Suppressed benign sandbox WebSocket error:', msg);
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('WS ') || msg.includes('HMR')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('Suppressed benign sandbox WebSocket error:', msg);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

