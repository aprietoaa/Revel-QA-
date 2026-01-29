import { test } from '@playwright/test';
import { LoginPage } from '../pages/login-page';

test('Completar teléfono en driverevel login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();

  await loginPage.fillPhone('879542345');

  await page.waitForTimeout(5000);
});
