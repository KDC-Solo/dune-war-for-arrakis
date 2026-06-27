import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite app config. The pure-TS engine lives in src/engine and is consumed by the UI in src/ui.
export default defineConfig({
  root: '.',
  // Relative asset paths so the production build also works when dist/index.html is opened
  // directly (file://), not just when served. Dev still requires `npm run dev`.
  base: './',
  plugins: [react()],
});
