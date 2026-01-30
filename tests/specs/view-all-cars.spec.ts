import * as fs from 'fs';
import * as path from 'path';
import { test } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { CarsPage } from '../pages/cars-page';
import { PHONE, OTP } from '../config';
import { stepCheckpoint, keepPageOpenByTimer, waitForEnter } from '../helpers/test-helpers';
import { loadCookies, saveCookies } from '../utils/cookies';
import { logger } from '../utils/logger';
import { STEPS } from '../steps/view-all-cars.steps';

test('Ver todos los coches (con sesión/cookies si existen)', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  const loginPage = new LoginPage(page);
  const carsPage = new CarsPage(page);
  let needsLogin = true;
  let modelsManual: Array<{ model: string; price: string }> = [];
  const totalSteps = 14;

  await test.step(STEPS.loadCookies, async () => {
    logger.step(1, totalSteps, STEPS.loadCookies);
    const cookiesLoaded = await loadCookies(page);
    if (cookiesLoaded) needsLogin = false;
  });

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

  await test.step(STEPS.ensureSession, async () => {
    logger.step(3, totalSteps, STEPS.ensureSession);

    if (needsLogin) {
      logger.info('No hay sesión válida: se hará login (captcha manual + OTP).');
      await loginPage.performFullLogin(PHONE, OTP);
      await loginPage.gotoDashboard();
      await saveCookies(page);
    } else {
      await loginPage.gotoDashboard();
    }

    await loginPage.tryAcceptCookieConsent();
    // Verificación explícita de sesión: iniciales visibles en el header.
    await loginPage.assertLoggedInAndGetInitials();
  });

  await test.step(STEPS.viewAllCars, async () => {
    logger.step(4, totalSteps, STEPS.viewAllCars);
    await loginPage.clickViewAllCars();
    logger.success(`Navegado a: ${page.url()}`);
    await stepCheckpoint('Después de "Ver todos los coches"');
  });

  await test.step(STEPS.openBrand, async () => {
    logger.step(5, totalSteps, STEPS.openBrand);
    await carsPage.openBrandFilter({
      locatorOverride: process.env.BRAND_LOCATOR,
      testId: process.env.BRAND_TESTID,
    });
    logger.success('Paso 5 OK: filtro Marca abierto.');
    await stepCheckpoint('Después de abrir "Marca"');
  });

  await test.step(STEPS.viewAllBrands, async () => {
    logger.step(6, totalSteps, STEPS.viewAllBrands);
    logger.info('>>> Paso 6: buscando "Ver todas las marcas"...');
    const verTodas =
      process.env.VIEW_ALL_BRANDS_LOCATOR
        ? page.locator(process.env.VIEW_ALL_BRANDS_LOCATOR).first()
        : page.getByText(/ver todas las marcas/i).first();
    await verTodas.waitFor({ state: 'visible', timeout: 10_000 });
    await verTodas.click({ timeout: 5_000, noWaitAfter: true });
    logger.success('>>> Paso 6 listo. Filtro aplicado.');
  });

  await test.step(STEPS.reopenBrand, async () => {
    logger.step(7, totalSteps, STEPS.reopenBrand);
    logger.info('>>> Paso 7: pulsando en Marca de nuevo...');
    const clickOpt = { timeout: 5_000, noWaitAfter: true } as const;
    if (process.env.BRAND_LOCATOR) {
      const marca = page.locator(process.env.BRAND_LOCATOR).first();
      await marca.waitFor({ state: 'visible', timeout: 10_000 });
      await marca.click({ ...clickOpt, timeout: 10_000 });
    } else {
      const marcaByIndex = page.locator('div.ShortcutsFilterBar_filters__shorcuts__V25SQ > div:nth-child(7) div.FilterShortcutButton_filter__button__ZCF57 > p').first();
      const marcaByText = page.locator('div.FilterShortcutButton_filter__button__ZCF57').filter({ has: page.locator('p', { hasText: /marca/i }) }).locator('p').first();
      try {
        await marcaByIndex.waitFor({ state: 'visible', timeout: 5_000 });
        await marcaByIndex.click(clickOpt);
      } catch {
        logger.muted('Selector nth-child(7) no encontrado; probando por texto "Marca"...');
        await marcaByText.waitFor({ state: 'visible', timeout: 5_000 });
        await marcaByText.click(clickOpt);
      }
    }
    logger.success('>>> Paso 7 listo. Filtro Marca reabierto.');
  });

  await test.step(STEPS.selectBrandOpel, async () => {
    logger.step(8, totalSteps, STEPS.selectBrandOpel);
    await page.getByText(/opel/i).first().waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
    await carsPage.selectBrand('Opel', {
      locatorOverride: process.env.BRAND_OPEL_LOCATOR,
      testId: process.env.BRAND_OPEL_TESTID,
    });
    logger.success('Marca Opel seleccionada.');
  });

  await test.step(STEPS.listModels, async () => {
    logger.step(9, totalSteps, STEPS.listModels);
    await page.locator('article, [role="listitem"]').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    const modelsWithPrices = await carsPage.getVisibleModelsWithPrices({ brandName: 'Opel' });
    logger.info(`Coches visibles (${modelsWithPrices.length}): Opel + modelo (Frontera, Mokka, …) y precio`);
    modelsWithPrices.forEach((item, i) => logger.muted(`  ${i + 1}. ${item.model} - ${item.price}`));
    logger.success('Listado de modelos y precios obtenido.');
  });

  await test.step(STEPS.exchangeType, async () => {
    logger.step(10, totalSteps, STEPS.exchangeType);
    await carsPage.clickExchangeTypeFilter({
      locatorOverride:
        process.env.EXCHANGE_TYPE_LOCATOR ??
        '/html/body/div[8]/div/div/div[1]/div/div/div[2]/div[5]/div[1]/p',
      testId: process.env.EXCHANGE_TYPE_TESTID,
    });
    logger.success('Paso 10 OK: tipo de cambio pulsado.');
  });

  await test.step(STEPS.selectManualTransmission, async () => {
    logger.step(11, totalSteps, STEPS.selectManualTransmission);
    await page.getByText(/manual/i).first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    await carsPage.selectExchangeTypeOption('Manual', {
      locatorOverride: process.env.EXCHANGE_TYPE_OPTION_LOCATOR,
      testId: process.env.EXCHANGE_TYPE_OPTION_TESTID,
    });
    logger.success('Manual seleccionado en tipo de cambio.');
  });

  await test.step(STEPS.listModelsManual, async () => {
    logger.step(12, totalSteps, STEPS.listModelsManual);
    await page.locator('article, [role="listitem"]').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    modelsManual = await carsPage.getVisibleModelsWithPrices({ brandName: 'Opel' });
    logger.info(`Coches con cambio manual encontrados (${modelsManual.length}):`);
    modelsManual.forEach((item, i) => logger.muted(`  ${i + 1}. ${item.model} - ${item.price}`));
    logger.success('Listado de coches con cambio manual obtenido.');
  });

  await test.step(STEPS.clickFirstCar, async () => {
    logger.step(13, totalSteps, STEPS.clickFirstCar);
    const first = modelsManual[0];
    if (!first) throw new Error('No hay coches en el listado para pulsar.');
    await carsPage.clickFirstVisibleCar({
      firstListedModel: first.model,
      firstListedPrice: first.price,
      locatorOverride: process.env.FIRST_CAR_LOCATOR,
    });
    // El mensaje "Pulsado en: ..." ya se emite dentro de clickFirstVisibleCar
  });

  await test.step(STEPS.keepOpen, async () => {
    logger.step(14, totalSteps, STEPS.keepOpen);
    const now = new Date();
    const dateTime =
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0') +
      '-' +
      String(now.getHours()).padStart(2, '0') +
      '-' +
      String(now.getMinutes()).padStart(2, '0') +
      '-' +
      String(now.getSeconds()).padStart(2, '0');
    const screenshotPath = `tests/artifacts/view-all-cars-final-${dateTime}.png`;
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch((e) => {
      logger.muted(`No se pudo guardar el screenshot: ${e}`);
    });
    logger.success(`Screenshot guardado: ${screenshotPath}`);
    const mode = String(process.env.KEEP_OPEN_MODE ?? 'manual').toLowerCase();
    if (mode === 'manual') {
      if (process.stdin.isTTY) {
        await waitForEnter('Pulsa ENTER para finalizar (y cerrar el navegador).');
      } else {
        await keepPageOpenByTimer(page);
      }
      logger.success('Fin del test.');
      return;
    }

    await keepPageOpenByTimer(page);
    logger.success('Fin del test.');
  });
});

