import { test } from '@playwright/test';
import { LoginPage } from '../pages/login-page';

const STEPS = [
  'Ir a la página de login (driverevel.com/login)',
  'Rellenar teléfono y pulsar Continuar',
  'Esperar a que el usuario resuelva el captcha y aparezca el paso OTP',
  'Escribir el código OTP (8048)',
  'Aceptar cookies (popup CybotCookiebot)',
  'Esperar cierre de la página',
] as const;

function logStep(step: number, label: string) {
  console.log(`\n  [Paso ${step}/${STEPS.length}] ${label}`);
}

test('Completar teléfono en driverevel login', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  const loginPage = new LoginPage(page);

  await test.step(STEPS[0], async () => {
    logStep(1, STEPS[0]);
    await loginPage.goto();
  });

  await test.step(STEPS[1], async () => {
    logStep(2, STEPS[1]);
    await loginPage.fillPhone('879542345');
    await loginPage.clickContinueWhenEnabled();
  });

  await test.step(STEPS[2], async () => {
    logStep(3, STEPS[2]);
    await loginPage.waitForOtpStepReady();
  });

  await test.step(STEPS[3], async () => {
    logStep(4, STEPS[3]);
    await loginPage.fillOtp('8048');
  });

  await test.step(STEPS[4], async () => {
    logStep(5, STEPS[4]);
    await loginPage.acceptCookieConsent();
  });

  await test.step(STEPS[5], async () => {
    logStep(6, STEPS[5]);
    await page.waitForEvent('close');
  });
});
