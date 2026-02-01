import * as path from 'path';
import * as fs from 'fs';
import { defineConfig } from '@playwright/test';

const isCI = process.env.CI === 'true';

// Un fichero de log por ejecución; el logger y el reporter lo usan.
const LOGS_DIR = path.join(process.cwd(), 'tests', 'logs');
const ts = new Date();
const stamp =
  ts.getFullYear() +
  '-' +
  String(ts.getMonth() + 1).padStart(2, '0') +
  '-' +
  String(ts.getDate()).padStart(2, '0') +
  '-' +
  String(ts.getHours()).padStart(2, '0') +
  String(ts.getMinutes()).padStart(2, '0') +
  String(ts.getSeconds()).padStart(2, '0');
const logPath = path.join(LOGS_DIR, `run-${stamp}.log`);
process.env.PLAYWRIGHT_LOG_FILE = logPath;
try {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(logPath, '', 'utf-8');
} catch {
  // ignorar
}

export default defineConfig({
  testDir: './tests/specs',
  timeout: 30 * 1000,
  workers: 1,
  /** En CI: reintentar hasta 2 veces si falla (reduce flakiness por red/carga). En local: 0 para ver el fallo a la primera. */
  retries: isCI ? 2 : 0,
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
