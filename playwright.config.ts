import { defineConfig } from '@playwright/test';

// E2E config: tests drive the production build served by `vite preview`.
// Locally you can point at the system browser: PLAYWRIGHT_CHROMIUM=/usr/bin/chromium-browser
// (CI installs Playwright's own chromium via `npx playwright install`).
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
      : {},
  },
  projects: [
    // Desktop: every journey except the phone-specific spec.
    { name: 'desktop', testIgnore: /mobile/ },
    // Phone: the mobile spec only (portrait, touch) — the PWA's table form factor.
    {
      name: 'mobile',
      testMatch: /mobile/,
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
