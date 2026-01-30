import { defineConfig } from '@playwright/test';

const isCI = process.env.CI === 'true';

export default defineConfig({
  testDir: './tests/specs',
  timeout: 30 * 1000,
  workers: 1,
  /** Reporter 'list' en terminal + log por ejecución en tests/logs/ (FAIL si falla alguno) */
  reporter: [
    ['list'],
    ['./tests/reporters/run-logger.ts', {}],
  ],
  use: {
    headless: isCI,
    viewport: { width: 1280, height: 1024 },
    browserName: 'chromium',
    ...(isCI ? {} : { channel: 'chrome' as const }),
    launchOptions: {
      args: [
        '--disable-crashpad',
        '--disable-breakpad',
        '--disable-dev-shm-usage',
        
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process,Crashpad',
        '--crash-dumps-dir=/tmp',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
      ],
      ignoreDefaultArgs: ['--enable-crashpad', '--enable-crash-reporter'],
      env: {
        CHROME_CRASH_DIR: '/tmp',
        GOOGLE_API_KEY: 'no',
        GOOGLE_DEFAULT_CLIENT_ID: 'no',
        GOOGLE_DEFAULT_CLIENT_SECRET: 'no',
      },
    },
  },
});
