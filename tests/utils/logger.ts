type LogLevel = 'step' | 'info' | 'success' | 'warn' | 'error' | 'muted';

function supportsColor(): boolean {
  // Permite forzar color manualmente: FORCE_COLOR=1
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
  if (process.env.NO_COLOR) return false;
  if (process.env.TERM === 'dumb') return false;
  return Boolean(process.stdout.isTTY);
}

const ENABLE_COLOR = supportsColor();

function c(code: string, text: string): string {
  if (!ENABLE_COLOR) return text;
  return `\u001b[${code}m${text}\u001b[0m`;
}

const palette = {
  bold: (s: string) => c('1', s),
  dim: (s: string) => c('90', s),
  cyan: (s: string) => c('36', s),
  green: (s: string) => c('32', s),
  yellow: (s: string) => c('33', s),
  red: (s: string) => c('31', s),
  blue: (s: string) => c('34', s),
} as const;

function prefix(level: LogLevel): string {
  switch (level) {
    case 'success':
      return palette.green('✓');
    case 'warn':
      return palette.yellow('⚠');
    case 'error':
      return palette.red('✖');
    case 'info':
      return palette.blue('ℹ');
    case 'muted':
      return palette.dim('—');
    default:
      return '';
  }
}

export const logger = {
  step(step: number, total: number, label: string) {
    const badge = palette.cyan(`[Paso ${step}/${total}]`);
    console.log(`\n  ${badge} ${palette.bold(label)}`);
  },

  info(message: string) {
    console.log(`  ${prefix('info')} ${message}`);
  },

  success(message: string) {
    console.log(`  ${prefix('success')} ${message}`);
  },

  warn(message: string) {
    console.log(`  ${prefix('warn')} ${message}`);
  },

  error(message: string) {
    console.log(`  ${prefix('error')} ${message}`);
  },

  muted(message: string) {
    console.log(`  ${prefix('muted')} ${palette.dim(message)}`);
  },
} as const;

