import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `"${process.env.DONEE_TEST_PYTHON || (process.platform === 'win32' ? '../venv/Scripts/python.exe' : '../venv/bin/python')}" e2e/support/api_server.py`,
      url: 'http://127.0.0.1:8011/openapi.json',
      env: { DONEE_E2E_BACKEND: '1' },
      reuseExistingServer: false,
    },
    {
      command: 'npm run build && npm run preview',
      url: 'http://127.0.0.1:4173',
      env: {
        API_PROXY_TARGET: 'http://127.0.0.1:8011',
        VITE_API_BASE_URL: '/api',
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
