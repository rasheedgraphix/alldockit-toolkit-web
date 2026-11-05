import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Register Service Worker for 100% Offline Capability (Web only, skip in desktop Electron)
if (
  'serviceWorker' in navigator &&
  window.location.protocol.startsWith('http') &&
  !window.location.hostname.includes('localhost') &&
  !window.location.hostname.includes('run.app')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.warn('SW registration:', err));
  });
}
