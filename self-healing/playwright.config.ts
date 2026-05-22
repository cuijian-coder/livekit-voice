import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
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
      command: 'cd /home/jiancui2026/projects/livekit-voice && npx tsx self-healing/e2e/fixtures/start-mock-server.ts',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
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