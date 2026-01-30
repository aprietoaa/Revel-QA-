/**
 * Nombres de pasos del test de login (Completar teléfono en driverevel login).
 * Centralizados para reutilizar en el spec y en futuros tests de login.
 */

export const STEPS = {
  loadCookies: 'Cargar cookies guardadas (si existen)',
  verifySession: 'Verificar si la sesión es válida',
  acceptCookiesIfVisibleAfterSession: 'Aceptar cookies (si el popup aparece tras sesión válida)',
  login: 'Hacer login completo (teléfono → captcha → OTP)',
  saveCookies: 'Guardar cookies de sesión',
  acceptCookiesIfVisibleAfterLogin: 'Aceptar cookies (si el popup aparece después del login)',
  waitClose: 'Esperar 5 segundos (fin del test)',
} as const;
