/**
 * Entry point: mounts the React app into <div id="root"> in index.html.
 * <AuthProvider> wraps everything so every screen can ask who's logged in.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  // StrictMode runs extra checks in development to catch common React mistakes.
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
