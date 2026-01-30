import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { PHONE, WRONG_OTP } from '../config';
import { logger } from '../utils/logger';
import { STEPS } from '../steps/login-fail-otp.steps';

test('Login fallido: OTP incorrecto (sin tocar cookies)', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  const loginPage = new LoginPage(page);
  const totalSteps = 6;

  await test.step(STEPS.gotoLogin, async () => {
    logger.step(1, totalSteps, STEPS.gotoLogin);
    await loginPage.goto();
  });

  await test.step(STEPS.fillPhoneAndContinue, async () => {
    logger.step(2, totalSteps, STEPS.fillPhoneAndContinue);
    await loginPage.fillPhone(PHONE);
    await loginPage.clickContinueWhenEnabled();
  });

  await test.step(STEPS.waitCaptchaAndOtp, async () => {
    logger.step(3, totalSteps, STEPS.waitCaptchaAndOtp);
    await loginPage.waitForOtpStepReady();
  });

  await test.step(STEPS.fillWrongOtp, async () => {
    logger.step(4, totalSteps, STEPS.fillWrongOtp);
    await loginPage.fillOtp(WRONG_OTP);
  });

  await test.step(STEPS.acceptCookiesIfVisible, async () => {
    logger.step(5, totalSteps, STEPS.acceptCookiesIfVisible);
    await loginPage.tryAcceptCookieConsent();
  });

  await test.step(STEPS.verifyLoginFailed, async () => {
    logger.step(6, totalSteps, STEPS.verifyLoginFailed);
    // Comprobación genérica: seguir en URL de login
    await expect(page).toHaveURL(/.*login/);
    logger.success('Se detectó que el login falló (OTP incorrecto).');
  });
});

