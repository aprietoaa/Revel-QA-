import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/specs',
  timeout: 30 * 1000,
  /** Reporter 'list' muestra cada paso (test.step) en la terminal */
  reporter: 'list',
  use: {
    headless: false,
    viewport: { width: 1280, height: 1024 },
    browserName: 'chromium',
    channel: 'chrome',
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
