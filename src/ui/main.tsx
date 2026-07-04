import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';
import { App2 } from '../ui2/App2';

document.documentElement.dataset.ui = 'v2';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App2 />
    </ErrorBoundary>
  </React.StrictMode>,
);
