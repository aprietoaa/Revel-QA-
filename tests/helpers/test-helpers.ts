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
 * Mantiene la página abierta durante X segundos (KEEP_OPEN_SECONDS, por defecto 20).
 * Útil al final del test para revisar el resultado antes de cerrar.
 */
export async function keepPageOpenByTimer(page: {
  waitForTimeout: (ms: number) => Promise<void>;
}): Promise<void> {
  const keepOpenSeconds = Number(process.env.KEEP_OPEN_SECONDS ?? '20');
  const seconds = Number.isFinite(keepOpenSeconds) && keepOpenSeconds > 0 ? keepOpenSeconds : 20;
  logger.info(`Manteniendo la página abierta ${seconds}s... (configurable con KEEP_OPEN_SECONDS)`);
  for (let i = seconds; i >= 1; i -= 1) {
    if (i <= 10 || i % 60 === 0) {
      logger.muted(`Se cerrará en ${i}s`);
    }
    await page.waitForTimeout(1000);
  }
}
