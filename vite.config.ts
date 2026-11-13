/**
 * Vite settings (the dev server and the production build).
 *
 * The app always calls the backend at `/api/...` on its OWN address:
 *  - In development, Vite forwards `/api/*` to the backend (see `proxy` below).
 *  - In Docker, nginx does the same job (see nginx.conf).
 * Because the browser only ever talks to one address, the login cookie just works
 * and we avoid cross-origin (CORS) problems entirely.
 */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Read .env so VITE_PROXY_TARGET can point the dev proxy at a different backend port.
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_PROXY_TARGET || 'http://localhost:4000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // "/api/auth/me" in the browser -> "http://localhost:4000/auth/me" on the backend.
        '/api': {
          target: backend,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
