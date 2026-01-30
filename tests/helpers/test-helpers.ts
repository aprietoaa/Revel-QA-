/**
 * Helpers compartidos para los tests (pausas, checkpoints, mantener página abierta).
 * Cualquier spec puede importar estas funciones sin duplicar código.
 */

import { logger } from '../utils/logger';

/**
 * Espera a que el usuario pulse ENTER en la terminal.
 * En entornos no interactivos (CI) no bloquea y continúa.
 */
export async function waitForEnter(prompt: string): Promise<void> {
  if (!process.stdin.isTTY) {
    logger.muted('STDIN no es interactivo; se omite la espera de ENTER.');
    return;
  }

  logger.info(prompt);
  process.stdin.resume();
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });
  process.stdin.pause();
}

/**
 * Si STEP_BY_STEP está activo, pausa y pide ENTER antes de continuar.
 * Útil para inspeccionar el estado de la página entre pasos.
 */
export async function stepCheckpoint(label: string): Promise<void> {
  const enabled = String(process.env.STEP_BY_STEP ?? '1').toLowerCase();
  if (!['1', 'true', 'yes', 'y', 'on'].includes(enabled)) return;
  await waitForEnter(`Checkpoint: ${label}. Pulsa ENTER para continuar...`);
}

/**
 * Mantiene la página abierta durante X segundos.
 * @param page - Página con waitForTimeout (p. ej. Playwright Page).
 * @param overrideSeconds - Si se pasa, usa este valor; si no, usa KEEP_OPEN_SECONDS (por defecto 20).
 */
export async function keepPageOpenByTimer(
  page: { waitForTimeout: (ms: number) => Promise<void> },
  overrideSeconds?: number
): Promise<void> {
  const fromEnv = Number(process.env.KEEP_OPEN_SECONDS ?? '20');
  const seconds =
    overrideSeconds !== undefined
      ? (Number.isFinite(overrideSeconds) && overrideSeconds > 0 ? overrideSeconds : 20)
      : (Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 20);
  logger.info(
    overrideSeconds !== undefined
      ? `Manteniendo la página abierta ${seconds}s...`
      : `Manteniendo la página abierta ${seconds}s... (configurable con KEEP_OPEN_SECONDS)`
  );
  for (let i = seconds; i >= 1; i -= 1) {
    if (i <= 10 || i % 60 === 0) {
      logger.muted(`Se cerrará en ${i}s`);
    }
    await page.waitForTimeout(1000);
  }
}
