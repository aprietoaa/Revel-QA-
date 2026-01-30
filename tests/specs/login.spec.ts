import { test } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { loadCookies, saveCookies } from '../utils/cookies';

const STEPS = {
  loadCookies: 'Cargar cookies guardadas (si existen)',
  verifySession: 'Verificar si la sesión es válida',
  acceptCookiesIfVisibleAfterSession: 'Aceptar cookies (si el popup aparece tras sesión válida)',
  login: 'Hacer login completo (teléfono → captcha → OTP)',
  saveCookies: 'Guardar cookies de sesión',
  acceptCookiesIfVisibleAfterLogin: 'Aceptar cookies (si el popup aparece después del login)',
  waitClose: 'Esperar cierre de la página',
} as const;

const PHONE = '879542345';
const OTP = '8048';

function logStep(step: number, total: number, label: string) {
  console.log(`\n  [Paso ${step}/${total}] ${label}`);
}

test('Completar teléfono en driverevel login', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  const loginPage = new LoginPage(page);
  let needsLogin = true;
  const totalSteps = 6; // Ahora son 6 pasos con el nuevo paso condicional de cookies

  // Paso 1: Intentar cargar cookies guardadas
  await test.step(STEPS.loadCookies, async () => {
    logStep(1, totalSteps, STEPS.loadCookies);
    const cookiesLoaded = await loadCookies(page);
    if (cookiesLoaded) {
      needsLogin = false;
    }
  });

  // Paso 2: Verificar si la sesión es válida
  await test.step(STEPS.verifySession, async () => {
    logStep(2, totalSteps, STEPS.verifySession);
    if (!needsLogin) {
      const isValid = await loginPage.isSessionValid();
      if (!isValid) {
        console.log('  ⚠ Sesión expirada o inválida, se requiere login');
        needsLogin = true;
      } else {
        console.log('  ✓ Sesión válida, no se requiere login');
      }
    }
  });

  // Paso 3 (condicional): Aceptar cookies si el popup aparece tras cargar sesión válida
  if (!needsLogin) {
    await test.step(STEPS.acceptCookiesIfVisibleAfterSession, async () => {
      logStep(3, totalSteps, STEPS.acceptCookiesIfVisibleAfterSession);
      await loginPage.tryAcceptCookieConsent();
    });
  }

  // Pasos 4 y 5 (condicional): Hacer login completo y guardar cookies si es necesario
  if (needsLogin) {
    await test.step(STEPS.login, async () => {
      logStep(4, totalSteps, STEPS.login);
      await loginPage.performFullLogin(PHONE, OTP);
    });

    await test.step(STEPS.saveCookies, async () => {
      logStep(5, totalSteps, STEPS.saveCookies);
      await saveCookies(page);
    });

    // Paso 6 (condicional): Aceptar cookies si el popup aparece después del login
    await test.step(STEPS.acceptCookiesIfVisibleAfterLogin, async () => {
      logStep(6, totalSteps, STEPS.acceptCookiesIfVisibleAfterLogin);
      await loginPage.tryAcceptCookieConsent();
    });
  } else {
    console.log(`\n  [Paso 4/${totalSteps}] ⏭ Saltado: Login no necesario (sesión válida)`);
    console.log(`\n  [Paso 5/${totalSteps}] ⏭ Saltado: Cookies ya guardadas`);
    console.log(`\n  [Paso 6/${totalSteps}] ⏭ Saltado: No se espera popup de cookies tras sesión válida`);
  }

  // Paso final: Esperar cierre de la página (si no se hizo login, el paso de aceptar cookies fue el 3)
  await test.step(STEPS.waitClose, async () => {
    logStep(totalSteps, totalSteps, STEPS.waitClose);
    await page.waitForEvent('close');
  });
});
