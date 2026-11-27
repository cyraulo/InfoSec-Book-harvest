import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 60_000,
  globalSetup: './e2e/serve.js',
  use: { baseURL: 'http://localhost:4175', trace: 'retain-on-failure',
    channel: process.env.BROWSER_CHANNEL },
});
