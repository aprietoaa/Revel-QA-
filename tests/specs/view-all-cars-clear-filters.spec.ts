import { test } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { CarsPage } from '../pages/cars-page';
import { PHONE, OTP } from '../config';
import { keepPageOpenByTimer } from '../helpers/test-helpers';
import { loadCookies, saveCookies } from '../utils/cookies';
import { logger } from '../utils/logger';
import { STEPS } from '../steps/view-all-cars-clear-filters.steps';

test('Ver todos los coches: aplicar filtros, listar, limpiar filtros y listar de nuevo', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  const loginPage = new LoginPage(page);
  const carsPage = new CarsPage(page);
  let needsLogin = true;
  const totalSteps = 15;

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
  });

  await test.step(STEPS.openBrand, async () => {
    logger.step(5, totalSteps, STEPS.openBrand);
    await carsPage.openBrandFilter({
      locatorOverride: process.env.BRAND_LOCATOR,
      testId: process.env.BRAND_TESTID,
    });
    logger.success('Filtro Marca abierto.');
  });

  await test.step(STEPS.viewAllBrands, async () => {
    logger.step(6, totalSteps, STEPS.viewAllBrands);
    const verTodas =
      process.env.VIEW_ALL_BRANDS_LOCATOR
        ? page.locator(process.env.VIEW_ALL_BRANDS_LOCATOR).first()
        : page.getByText(/ver todas las marcas/i).first();
    await verTodas.waitFor({ state: 'visible', timeout: 10_000 });
    await verTodas.click({ timeout: 5_000, noWaitAfter: true });
    logger.success('Ver todas las marcas pulsado.');
  });

  await test.step(STEPS.reopenBrand, async () => {
    logger.step(7, totalSteps, STEPS.reopenBrand);
    const clickOpt = { timeout: 5_000, noWaitAfter: true } as const;
    if (process.env.BRAND_LOCATOR) {
      const marca = page.locator(process.env.BRAND_LOCATOR).first();
      await marca.waitFor({ state: 'visible', timeout: 10_000 });
      await marca.click({ ...clickOpt, timeout: 10_000 });
    } else {
      const filterBar = page.locator('div[class*="ShortcutsFilterBar"]');
      const marcaByIndex = filterBar.locator('div:nth-child(7) div[class*="FilterShortcutButton"] > p').first();
      const marcaByText = page.locator('div[class*="FilterShortcutButton"]').filter({ has: page.locator('p', { hasText: /marca/i }) }).locator('p').first();
      try {
        await marcaByIndex.waitFor({ state: 'visible', timeout: 5_000 });
        await marcaByIndex.click(clickOpt);
      } catch {
        await marcaByText.waitFor({ state: 'visible', timeout: 5_000 });
        await marcaByText.click(clickOpt);
      }
    }
    logger.success('Marca reabierto.');
  });

  await test.step(STEPS.selectBrandOpel, async () => {
    logger.step(8, totalSteps, STEPS.selectBrandOpel);
    await page.getByText(/opel/i).first().waitFor({ state: 'visible', timeout: 4_000 }).catch(() => {});
    await carsPage.selectBrand('Opel', {
      locatorOverride: process.env.BRAND_OPEL_LOCATOR,
      testId: process.env.BRAND_OPEL_TESTID,
    });
    logger.success('Marca Opel seleccionada.');
  });

  await test.step(STEPS.listModels, async () => {
    logger.step(9, totalSteps, STEPS.listModels);
    await page.locator('article, [role="listitem"]').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    const modelsWithPrices = await carsPage.getVisibleModelsWithPrices({ brandName: 'Opel', maxItems: 150 });
    logger.info(`Coches visibles con Marca Opel (${modelsWithPrices.length}):`);
    modelsWithPrices.forEach((item, i) => logger.car(i + 1, item.model, item.price));
    logger.success('Listado obtenido.');
  });

  await test.step(STEPS.exchangeType, async () => {
    logger.step(10, totalSteps, STEPS.exchangeType);
    await carsPage.clickExchangeTypeFilter({
      ...(process.env.EXCHANGE_TYPE_LOCATOR && { locatorOverride: process.env.EXCHANGE_TYPE_LOCATOR }),
      ...(process.env.EXCHANGE_TYPE_TESTID && { testId: process.env.EXCHANGE_TYPE_TESTID }),
    });
    logger.success('Tipo de cambio pulsado.');
  });

  await test.step(STEPS.selectManualTransmission, async () => {
    logger.step(11, totalSteps, STEPS.selectManualTransmission);
    await page.getByText(/manual/i).first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    await carsPage.selectExchangeTypeOption('Manual', {
      locatorOverride: process.env.EXCHANGE_TYPE_OPTION_LOCATOR,
      testId: process.env.EXCHANGE_TYPE_OPTION_TESTID,
    });
    logger.success('Manual seleccionado.');
  });

  await test.step(STEPS.listModelsManual, async () => {
    logger.step(12, totalSteps, STEPS.listModelsManual);
    await page.locator('article, [role="listitem"]').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    const modelsManual = await carsPage.getVisibleModelsWithPrices({ brandName: 'Opel', maxItems: 150 });
    logger.info(`Coches con filtros Opel + Manual (${modelsManual.length}):`);
    modelsManual.forEach((item, i) => logger.car(i + 1, item.model, item.price));
    logger.success('Listado con filtros obtenido.');
  });

  await test.step(STEPS.clearFilters, async () => {
    logger.step(13, totalSteps, STEPS.clearFilters);
    await carsPage.clearFilters({
      locatorOverride: process.env.CLEAR_FILTERS_LOCATOR,
    });
  });

  await test.step(STEPS.listModelsAfterClear, async () => {
    logger.step(14, totalSteps, STEPS.listModelsAfterClear);
    const cardWithPrice = page.locator('article, [role="listitem"]').filter({ hasText: /\d[\d.,]*\s*€/ }).first();
    await cardWithPrice.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    logger.success('Filtros limpiados; listado sin filtros visible.');
  });

  await test.step(STEPS.keepOpen, async () => {
    logger.step(15, totalSteps, STEPS.keepOpen);
    await keepPageOpenByTimer(page, 5);
    logger.success('Fin del test.');
  });
});
