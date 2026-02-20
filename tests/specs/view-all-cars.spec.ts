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
  test.setTimeout(5 * 60 * 1000); // 5 min: fallar antes si algo se cuelga
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
    try {
      await loginPage.assertLoggedInAndGetInitials();
    } catch {
      logger.warn('Sesión no válida tras cargar cookies (p. ej. caducadas). Se hará login.');
      await loginPage.performFullLogin(PHONE, OTP);
      await loginPage.gotoDashboard();
      await saveCookies(page);
      await loginPage.tryAcceptCookieConsent();
      await loginPage.assertLoggedInAndGetInitials();
    }
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
    await carsPage.clickViewAllBrands({
      locatorOverride: process.env.VIEW_ALL_BRANDS_LOCATOR,
    });
    logger.success('Paso 6 listo: Ver todas las marcas aplicado.');
  });

  await test.step(STEPS.reopenBrand, async () => {
    logger.step(7, totalSteps, STEPS.reopenBrand);
    await carsPage.reopenBrandFilter({
      locatorOverride: process.env.BRAND_LOCATOR,
    });
    logger.success('Paso 7 listo: Filtro Marca reabierto.');
  });

  await test.step(STEPS.selectBrandOpel, async () => {
    logger.step(8, totalSteps, STEPS.selectBrandOpel);
    await carsPage.selectBrand('Opel', {
      locatorOverride: process.env.BRAND_OPEL_LOCATOR,
      testId: process.env.BRAND_OPEL_TESTID,
    });
    logger.success('Marca Opel seleccionada.');
  });

  await test.step(STEPS.listModels, async () => {
    logger.step(9, totalSteps, STEPS.listModels);
    await carsPage.waitForGridVisible({ timeout: 10_000 });
    const modelsWithPrices = await carsPage.getVisibleModelsWithPrices({ brandName: 'Opel', maxItems: 150 });
    logger.info(`Coches visibles (${modelsWithPrices.length}): Opel + modelo (Frontera, Mokka, …) y precio`);
    modelsWithPrices.forEach((item, i) => logger.car(i + 1, item.model, item.price));
    logger.success('Listado de modelos y precios obtenido.');
  });

  await test.step(STEPS.exchangeType, async () => {
    logger.step(10, totalSteps, STEPS.exchangeType);
    await carsPage.clickExchangeTypeFilter({
      ...(process.env.EXCHANGE_TYPE_LOCATOR && { locatorOverride: process.env.EXCHANGE_TYPE_LOCATOR }),
      ...(process.env.EXCHANGE_TYPE_TESTID && { testId: process.env.EXCHANGE_TYPE_TESTID }),
    });
    logger.success('Paso 10 OK: tipo de cambio pulsado.');
  });

  await test.step(STEPS.selectManualTransmission, async () => {
    logger.step(11, totalSteps, STEPS.selectManualTransmission);
    await carsPage.selectExchangeTypeOption('Manual', {
      locatorOverride: process.env.EXCHANGE_TYPE_OPTION_LOCATOR,
      testId: process.env.EXCHANGE_TYPE_OPTION_TESTID,
    });
    logger.success('Manual seleccionado en tipo de cambio.');
  });

  await test.step(STEPS.listModelsManual, async () => {
    logger.step(12, totalSteps, STEPS.listModelsManual);
    await carsPage.waitForGridVisible({ timeout: 10_000 });
    modelsManual = await carsPage.getVisibleModelsWithPrices({ brandName: 'Opel', maxItems: 150 });
    logger.info(`Coches con cambio manual encontrados (${modelsManual.length}):`);
    modelsManual.forEach((item, i) => logger.car(i + 1, item.model, item.price));
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

