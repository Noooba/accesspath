import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const bundledBrowsers = 'C:/Users/junec/.agents/skills/web-development/assets/browsers';
const bundledChromium = `${bundledBrowsers}/chromium_headless_shell-1247/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const bundledFirefox = `${bundledBrowsers}/firefox-1532/firefox/firefox.exe`;
const chromiumPath = process.env.ACCESSPATH_CHROMIUM_PATH ?? (existsSync(bundledChromium) ? bundledChromium : undefined);
const firefoxPath = process.env.ACCESSPATH_FIREFOX_PATH ?? (existsSync(bundledFirefox) ? bundledFirefox : undefined);
const startIsolatedServer = process.env.ACCESSPATH_E2E_START_SERVER === '1';
const baseURL = process.env.ACCESSPATH_E2E_BASE_URL ?? 'http://127.0.0.1:3060';
const port = new URL(baseURL).port || '3060';
// Only the opt-in test server receives these throwaway credentials. Never read a user's admin key.
const adminKey = process.env.ACCESSPATH_E2E_ADMIN_KEY ?? (startIsolatedServer ? randomBytes(32).toString('hex') : undefined);
if (adminKey) process.env.ACCESSPATH_E2E_ADMIN_KEY = adminKey;
const databaseURL = `file:${resolve('data', `accesspath-e2e-${Date.now()}.db`).replaceAll('\\', '/')}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  outputDir: 'test-results',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL, viewport: { width: 1440, height: 900 },
    // No traces/network bodies containing even ephemeral sign-in credentials are saved.
    trace: 'off', screenshot: 'only-on-failure', video: 'off',
  },
  projects: [
    { name: 'chromium', testIgnore: '**/cross-browser.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: { executablePath: chromiumPath, args: ['--no-sandbox'] } } },
    { name: 'firefox', testMatch: '**/cross-browser.spec.ts', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 }, launchOptions: { executablePath: firefoxPath } } },
  ],
  ...(startIsolatedServer ? { webServer: {
    command: `node ./node_modules/next/dist/bin/next start -p ${port}`,
    url: `${baseURL}/api/sites`, reuseExistingServer: false, timeout: 90_000,
    env: { DATABASE_URL: databaseURL, ADMIN_KEY: adminKey!, SESSION_SECRET: randomBytes(32).toString('hex') },
  } } : {}),
});
