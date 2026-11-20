import process from "node:process";
import { defineConfig, devices } from '@playwright/test';

// SCRUM-270: test the real Vite -> Express -> Supabase session lifecycle.
// E2E_BASE_URL may point to an independently running isolated test deployment.
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const external = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false, // The four flows can share one disposable account safely.
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: external ? undefined : [
    {
      command: 'npm run start',
      cwd: '../backend',
      url: 'http://127.0.0.1:3001/api/auth/me',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
      cwd: '.',
      env: { VITE_ENABLE_ROUTE_PROTECTION: 'true' },
      url: baseURL + '/login',
      reuseExistingServer: false, // Prevent using a dev server with the auth bypass enabled.
      timeout: 60_000,
    },
  ],
});
