import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';

// Forzar color en consola (Playwright suele ejecutar sin TTY y chalk lo desactiva).
// Solo desactivar si el usuario pone NO_COLOR.
if (process.env.NO_COLOR && !process.env.FORCE_COLOR) {
  chalk.level = 0;
} else {
  chalk.level = 2; // 256 colores, visible aunque stdout no sea TTY
}

/** Quita códigos ANSI para guardar en fichero de texto. */
function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

/** Para fichero de log: etiquetas legibles sin color */
const fileStyle = {
  step: (step: number, total: number, label: string) => `[PASO ${step}/${total}] ${label}`,
  info: (msg: string) => `[INFO]  ${msg}`,
  success: (msg: string) => `[OK]    ${msg}`,
  warn: (msg: string) => `[WARN]  ${msg}`,
  error: (msg: string) => `[ERROR] ${msg}`,
  muted: (msg: string) => `  · ${msg}`,
  car: (index: number, model: string, price: string) => `  ${index}. ${model} - ${price}`,
} as const;

let logFileStream: fs.WriteStream | null = null;

function ensureLogFile(): fs.WriteStream | null {
  const filepath = process.env.PLAYWRIGHT_LOG_FILE;
  if (!filepath) return null;
  if (logFileStream) return logFileStream;
  try {
    const dir = path.dirname(filepath);
    fs.mkdirSync(dir, { recursive: true });
    logFileStream = fs.createWriteStream(filepath, { flags: 'a' });
  } catch {
    return null;
  }
  return logFileStream;
}

function writeToFile(plainLine: string): void {
  const stream = ensureLogFile();
  if (!stream) return;
  try {
    stream.write(plainLine + '\n');
  } catch {
    // ignorar
  }
}

function logLine(colored: string, plain: string): void {
  console.log(colored);
  writeToFile(plain);
}

// Iconos y colores bien visibles (chalk en cada uno para que siempre se vean)
const icons = {
  step: chalk.cyan.bold('▶'),
  info: chalk.blue('ℹ'),
  success: chalk.green('✔'),
  warn: chalk.yellow('⚠'),
  error: chalk.red('✖'),
  muted: chalk.gray('›'),
} as const;

export const logger = {
  step(step: number, total: number, label: string) {
    const badge = chalk.cyan.bold(`PASO ${step}/${total}`);
    const title = icons.step + '  ' + badge + '  ' + chalk.white.bold(label);
    const boxed = boxen(title, {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      margin: { top: 1, bottom: 1 },
      borderStyle: 'round',
      borderColor: 'cyan',
    });
    console.log(boxed);
    writeToFile('');
    writeToFile('  ════════════════════════════════════════════════════════');
    writeToFile('  ' + fileStyle.step(step, total, label));
    writeToFile('  ════════════════════════════════════════════════════════');
  },

  info(message: string) {
    logLine('  ' + icons.info + '  ' + chalk.blue.bold(message), '  ' + fileStyle.info(message));
  },

  success(message: string) {
    logLine('  ' + icons.success + '  ' + chalk.green.bold(message), '  ' + fileStyle.success(message));
  },

  warn(message: string) {
    logLine('  ' + icons.warn + '  ' + chalk.yellow.bold(message), '  ' + fileStyle.warn(message));
  },

  error(message: string) {
    logLine('  ' + icons.error + '  ' + chalk.red.bold(message), '  ' + fileStyle.error(message));
  },

  muted(message: string) {
    logLine('  ' + icons.muted + '  ' + chalk.gray(message), '  ' + fileStyle.muted(message));
  },

  /** Línea de coche visible: icono 🚗 en color, número cyan, modelo amarillo, precio verde */
  car(index: number, model: string, price: string) {
    const icon = chalk.cyan('🚗');
    const num = chalk.cyan.bold(`[${index}]`);
    const modelText = chalk.yellow.bold(model);
    const sep = chalk.gray('  —  ');
    const priceText = chalk.green.bold(price);
    const line = '  ' + icon + '  ' + num + '  ' + modelText + sep + priceText;
    logLine(line, fileStyle.car(index, model, price));
  },
} as const;
