import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// ============================================
// VITE CONFIG - LOCAL DEVELOPMENT
// ============================================
//
// For local testing with backend, use ONE of these options:
//
// OPTION 1 (Recommended): Run `vercel dev` instead of `npm run dev`
//   - This starts BOTH frontend and backend on http://localhost:3000
//   - No proxy needed, API calls go to same origin
//
// OPTION 2: Run two terminals:
//   - Terminal 1: `npm run dev` (frontend on :5173)
//   - Terminal 2: `vercel dev --listen 3000` (backend on :3000)
//   - Vite proxies /api to localhost:3000
//
// OPTION 3: Use production backend (current config if no local backend)
//   - Frontend on :5173, API calls go to production Vercel
//   - Requires valid VITE_ADMIN_API_KEY matching production
// ============================================

// Detect if local backend is available
const LOCAL_BACKEND =
  process.env.VITE_LOCAL_BACKEND === 'true' || process.env.LOCAL_BACKEND === 'true';

// Default to local backend for development
const API_TARGET = LOCAL_BACKEND ? 'http://localhost:3001' : 'https://neuro-guardian.vercel.app';

console.log(`📡 Vite API Proxy Target: ${API_TARGET}`);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: API_TARGET.startsWith('https'),
        // Log proxy requests in development
        configure: proxy => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log(`🔀 Proxying: ${req.method} ${req.url} → ${API_TARGET}`);
          });
          proxy.on('error', (err, req) => {
            console.error(`❌ Proxy error for ${req.url}:`, err.message);
          });
        },
      },
    },
  },
});
