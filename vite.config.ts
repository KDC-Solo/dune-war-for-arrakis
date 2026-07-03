import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

// Vite app config. The pure-TS engine lives in src/engine and is consumed by the UI in src/ui.
export default defineConfig({
  root: '.',
  // Relative asset paths so the production build also works when dist/index.html is opened
  // directly (file://), not just when served. Dev still requires `npm run dev`.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Vitest covers the unit suites only; e2e/*.spec.ts belongs to Playwright.
  test: { include: ['src/**/*.test.ts'] },
  plugins: [
    react(),
    // PWA: installable + offline at the table (replaces the scrapped Capacitor plan). The service
    // worker precaches the built assets and auto-updates on new deploys.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Dune: War for Arrakis — Solo Companion',
        short_name: 'DWFA Solo',
        description:
          'Runs the Mahdi solo-mode Harkonnen AI for Dune: War for Arrakis. You play Atreides on the physical board; the app decides the Harkonnen actions.',
        theme_color: '#8b1f30',
        background_color: '#e8d9b8',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
