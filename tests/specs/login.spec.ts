import { test } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { PHONE, OTP } from '../config';
import { keepPageOpenByTimer } from '../helpers/test-helpers';
import { loadCookies, saveCookies } from '../utils/cookies';
import { logger } from '../utils/logger';
import { STEPS } from '../steps/login.steps';

test('Completar teléfono en driverevel login', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  const loginPage = new LoginPage(page);
  let needsLogin = true;
  const totalSteps = 6; // Ahora son 6 pasos con el nuevo paso condicional de cookies

  // Paso 1: Intentar cargar cookies guardadas
  await test.step(STEPS.loadCookies, async () => {
    logger.step(1, totalSteps, STEPS.loadCookies);
    const cookiesLoaded = await loadCookies(page);
    if (cookiesLoaded) {
      needsLogin = false;
    }
  });

  // Paso 2: Verificar si la sesión es válida
  await test.step(STEPS.verifySession, async () => {
    logger.step(2, totalSteps, STEPS.verifySession);
    if (!needsLogin) {
      const isValid = await loginPage.isSessionValid();
      if (!isValid) {
        logger.warn('Sesión expirada o inválida, se requiere login');
        needsLogin = true;
      } else {
        logger.success('Sesión válida, no se requiere login');
      }
    }
  });

  // Paso 3 (condicional): Aceptar cookies si el popup aparece tras cargar sesión válida
  if (!needsLogin) {
    await test.step(STEPS.acceptCookiesIfVisibleAfterSession, async () => {
      logger.step(3, totalSteps, STEPS.acceptCookiesIfVisibleAfterSession);
      await loginPage.tryAcceptCookieConsent();
    });
  }

  // Pasos 4 y 5 (condicional): Hacer login completo y guardar cookies si es necesario
  if (needsLogin) {
    await test.step(STEPS.login, async () => {
      logger.step(4, totalSteps, STEPS.login);
      await loginPage.performFullLogin(PHONE, OTP);
    });

    await test.step(STEPS.saveCookies, async () => {
      logger.step(5, totalSteps, STEPS.saveCookies);
      await saveCookies(page);
    });

    // Paso 6 (condicional): Aceptar cookies si el popup aparece después del login
    await test.step(STEPS.acceptCookiesIfVisibleAfterLogin, async () => {
      logger.step(6, totalSteps, STEPS.acceptCookiesIfVisibleAfterLogin);
      await loginPage.tryAcceptCookieConsent();
    });
  } else {
    logger.step(4, totalSteps, 'Saltado: Login no necesario (sesión válida)');
    logger.muted('Login no necesario (sesión válida)');
    logger.step(5, totalSteps, 'Saltado: Cookies ya guardadas');
    logger.muted('Cookies ya guardadas');
    logger.step(6, totalSteps, 'Saltado: No se espera popup de cookies tras sesión válida');
    logger.muted('No se espera popup de cookies tras sesión válida');
  }

  // Paso final: mantener página abierta 5 s (misma lógica que keepPageOpenByTimer)
  await test.step(STEPS.waitClose, async () => {
    logger.step(totalSteps, totalSteps, STEPS.waitClose);
    await keepPageOpenByTimer(page, 5);
    logger.success('Fin del test.');
  });
});
