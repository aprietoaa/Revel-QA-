import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { logger } from '../utils/logger';

const PHONE = '879542345';
const WRONG_OTP = '1111';

test('Login fallido: OTP incorrecto (sin tocar cookies)', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  const loginPage = new LoginPage(page);
  const totalSteps = 6;

  // Paso 1: Ir a la página de login
  await test.step('Ir a la página de login', async () => {
    logger.step(1, totalSteps, 'Ir a la página de login');
    await loginPage.goto();
  });

  // Paso 2: Rellenar teléfono y pulsar Continuar
  await test.step('Rellenar teléfono y pulsar Continuar', async () => {
    logger.step(2, totalSteps, 'Rellenar teléfono y pulsar Continuar');
    await loginPage.fillPhone(PHONE);
    await loginPage.clickContinueWhenEnabled();
  });

  // Paso 3: Esperar a que se resuelva el captcha manualmente y aparezca el paso OTP
  await test.step('Esperar captcha y paso OTP', async () => {
    logger.step(3, totalSteps, 'Esperar captcha y paso OTP (resolución manual)');
    await loginPage.waitForOtpStepReady();
  });

  // Paso 4: Introducir OTP incorrecto
  await test.step('Introducir OTP incorrecto', async () => {
    logger.step(4, totalSteps, 'Introducir OTP incorrecto');
    await loginPage.fillOtp(WRONG_OTP);
  });

  // Paso 5: Intentar aceptar cookies si aparece el popup
  await test.step('Aceptar cookies si aparece', async () => {
    logger.step(5, totalSteps, 'Aceptar cookies si aparece');
    await loginPage.tryAcceptCookieConsent();
  });

  // Paso 6: Verificar fallo de login (se mantiene en la página de login o muestra error)
  await test.step('Verificar fallo por OTP incorrecto', async () => {
    logger.step(6, totalSteps, 'Verificar fallo por OTP incorrecto');
    // Comprobación genérica: seguir en URL de login
    await expect(page).toHaveURL(/.*login/);
    logger.success('Se detectó que el login falló (OTP incorrecto).');
  });
});

