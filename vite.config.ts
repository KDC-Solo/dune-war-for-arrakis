import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite app config. The pure-TS engine lives in src/engine and is consumed by the UI in src/ui.
export default defineConfig({
  root: '.',
  plugins: [react()],
});
