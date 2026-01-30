import * as fs from 'fs';
import * as path from 'path';
import { Page } from '@playwright/test';

/** Ruta donde se guardan las cookies de sesión */
const COOKIES_FILE = path.join(process.cwd(), 'tests', 'fixtures', 'cookies.json');

/**
 * Formatea el tiempo restante de forma legible (días, horas, minutos).
 */
function formatTimeRemaining(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} día${days > 1 ? 's' : ''} y ${hours % 24} hora${hours % 24 !== 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hora${hours > 1 ? 's' : ''} y ${minutes % 60} minuto${minutes % 60 !== 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
  }
  return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
}

/**
 * Calcula la fecha de expiración más lejana de las cookies.
 */
function getMaxExpiration(cookies: any[]): number | null {
  let maxExpiration: number | null = null;
  for (const cookie of cookies) {
    if (cookie.expires && cookie.expires > 0) {
      const expirationMs = cookie.expires * 1000; // expires está en segundos
      if (!maxExpiration || expirationMs > maxExpiration) {
        maxExpiration = expirationMs;
      }
    }
  }
  return maxExpiration;
}

/**
 * Guarda las cookies de la sesión actual en un archivo.
 * Se ejecuta después de un login exitoso.
 */
export async function saveCookies(page: Page): Promise<void> {
  const cookiesDir = path.dirname(COOKIES_FILE);
  if (!fs.existsSync(cookiesDir)) {
    fs.mkdirSync(cookiesDir, { recursive: true });
  }

  const cookies = await page.context().cookies();
  const maxExpiration = getMaxExpiration(cookies);
  const cookiesData = {
    cookies,
    savedAt: Date.now(),
    expiresAt: maxExpiration,
  };
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookiesData, null, 2));

  if (maxExpiration) {
    const timeRemaining = maxExpiration - Date.now();
    const formatted = formatTimeRemaining(timeRemaining);
    console.log(`  ✓ Cookies guardadas - Válidas por: ${formatted}`);
  } else {
    console.log(`  ✓ Cookies guardadas - Sin fecha de expiración (sesión)`);
  }
}

/**
 * Carga las cookies guardadas en el contexto de la página.
 * Retorna true si se cargaron cookies, false si no existen.
 */
export async function loadCookies(page: Page): Promise<boolean> {
  if (!fs.existsSync(COOKIES_FILE)) {
    return false;
  }

  try {
    const cookiesData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
    await page.context().addCookies(cookiesData.cookies);

    const ageMinutes = Math.floor((Date.now() - cookiesData.savedAt) / (1000 * 60));
    console.log(`  ✓ Cookies cargadas (guardadas hace ${ageMinutes} minuto${ageMinutes !== 1 ? 's' : ''})`);

    // Mostrar tiempo restante de validez
    if (cookiesData.expiresAt) {
      const timeRemaining = cookiesData.expiresAt - Date.now();
      if (timeRemaining > 0) {
        const formatted = formatTimeRemaining(timeRemaining);
        console.log(`  ✓ Tiempo restante de validez: ${formatted}`);
      } else {
        console.log(`  ⚠ Cookies expiradas (expiraron hace ${formatTimeRemaining(-timeRemaining)})`);
      }
    } else {
      console.log(`  ⚠ Cookies sin fecha de expiración (sesión)`);
    }

    return true;
  } catch (error) {
    console.log(`  ⚠ Error cargando cookies: ${error}`);
    return false;
  }
}

/**
 * Elimina el archivo de cookies (útil para forzar nuevo login).
 */
export function deleteCookies(): void {
  if (fs.existsSync(COOKIES_FILE)) {
    fs.unlinkSync(COOKIES_FILE);
    console.log(`  ✓ Cookies eliminadas`);
  }
}
