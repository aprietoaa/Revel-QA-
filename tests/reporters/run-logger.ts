/**
 * Reporter que escribe un fichero de log por cada ejecución en tests/logs/.
 * El logger de tests escribe la salida de consola en ese mismo fichero.
 * Al final de la ejecución se añade un resumen (RUN_RESULT: PASS/FAIL, tests, etc.).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Reporter, FullResult, TestCase, TestResult } from '@playwright/test/reporter';

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
    const filepath = process.env.PLAYWRIGHT_LOG_FILE;
    if (!filepath) return;

    const isFail = result.status !== 'passed';
    const runResult = isFail ? 'FAIL' : 'PASS';
    const lines: string[] = [
      '',
      '════════════════════════════════════════════════════════',
      'RESUMEN DE EJECUCIÓN',
      '════════════════════════════════════════════════════════',
      `RUN_RESULT: ${runResult}`,
      `DATE: ${this.startTime.toISOString()}`,
      `DURATION_MS: ${result.duration ?? 0}`,
      '',
      '--- TESTS ---',
      ...this.entries.map((e) => `[${e.status.toUpperCase()}] ${e.title}`),
    ];

    try {
      fs.appendFileSync(filepath, lines.join('\n') + '\n', 'utf-8');
    } catch (err) {
      console.error(`RunLogger: no se pudo escribir en ${filepath}:`, err);
    }
  }
}

export default RunLoggerReporter;
