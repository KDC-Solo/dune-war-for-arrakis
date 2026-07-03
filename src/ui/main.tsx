import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';

// v2 (board-first shell, PRD.md) is the default on this branch; `?classic` keeps the v1 panel
// UI reachable until the M7 parity gate. Styles are imported per-UI so they never mix.
const classic = new URLSearchParams(location.search).has('classic');
document.documentElement.dataset.ui = classic ? 'v1' : 'v2';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

(async () => {
  const { App } = classic
    ? await (async () => {
        await import('./styles.css');
        const m = await import('./App');
        return { App: m.App };
      })()
    : await (async () => {
        const m = await import('../ui2/App2');
        return { App: m.App2 };
      })();
  createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
})();
