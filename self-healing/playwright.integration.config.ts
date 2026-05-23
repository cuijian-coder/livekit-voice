import { defineConfig, devices } from '@playwright/test'

/**
 * Integration Test Config — Uses REAL backend (ASR + LLM + TTS)
 *
 * This config starts the actual backend server instead of the mock server.
 * Each test run incurs real API costs (~¥0.05).
 *
 * Usage:
 *   npx playwright test self-healing/e2e/integration/ \
 *     -c self-healing/playwright.integration.config.ts
 */
export default defineConfig({
  testDir: './e2e/integration',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Real backend ASR stream does not support concurrent clients
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      // Start real backend (ASR + LLM + TTS)
      command: 'cd /home/jiancui2026/projects/livekit-voice/backend && npx tsx watch src/main.ts',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      // Start frontend dev server
      command: 'cd /home/jiancui2026/projects/livekit-voice/frontend && npx vite --clearScreen false',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--disable-features=AudioCaptureLabsUI',
          ]
        }
      },
    },
  ],
})
