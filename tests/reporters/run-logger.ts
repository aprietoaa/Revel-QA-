/**
 * Reporter que escribe un fichero de log por cada ejecución en tests/logs/.
 * Si algún test falla, el archivo indica RUN_RESULT: FAIL.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Reporter, FullResult, TestCase, TestResult } from '@playwright/test/reporter';

const LOGS_DIR = path.join(process.cwd(), 'tests', 'logs');

interface Entry {
  title: string;
  status: string;
}

class RunLoggerReporter implements Reporter {
  private entries: Entry[] = [];
  private startTime: Date = new Date();

  printsToStdio(): boolean {
    return false;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.entries.push({
      title: test.title,
      status: result.status,
    });
  }

  onEnd(result: FullResult): void {
    const isFail = result.status !== 'passed';
    const dateTime =
      this.startTime.getFullYear() +
      '-' +
      String(this.startTime.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(this.startTime.getDate()).padStart(2, '0') +
      '-' +
      String(this.startTime.getHours()).padStart(2, '0') +
      '-' +
      String(this.startTime.getMinutes()).padStart(2, '0') +
      '-' +
      String(this.startTime.getSeconds()).padStart(2, '0');

    const filename = `run-${dateTime}.log`;
    const filepath = path.join(LOGS_DIR, filename);

    const runResult = isFail ? 'FAIL' : 'PASS';
    const lines: string[] = [
      `RUN_RESULT: ${runResult}`,
      `DATE: ${this.startTime.toISOString()}`,
      `DURATION_MS: ${result.duration ?? 0}`,
      '',
      '--- TESTS ---',
      ...this.entries.map((e) => `[${e.status.toUpperCase()}] ${e.title}`),
    ];

    try {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
      fs.writeFileSync(filepath, lines.join('\n'), 'utf-8');
    } catch (err) {
      console.error(`RunLogger: no se pudo escribir ${filepath}:`, err);
    }
  }
}

export default RunLoggerReporter;
