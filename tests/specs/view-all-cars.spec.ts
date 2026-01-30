import { test } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { CarsPage } from '../pages/cars-page';
import { loadCookies, saveCookies } from '../utils/cookies';
import { logger } from '../utils/logger';

const PHONE = '879542345';
const OTP = '8048';

async function waitForEnter(prompt: string): Promise<void> {
  if (!process.stdin.isTTY) {
    // En entornos no interactivos (CI / algunas terminals), no podemos esperar ENTER.
    // No bloqueamos el test aquí (si no, no llegaría a los siguientes pasos como "Marca").
    logger.muted('STDIN no es interactivo; se omite la espera de ENTER.');
    return;
  }

  logger.info(prompt);
  process.stdin.resume();
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });
  process.stdin.pause();
}

async function stepCheckpoint(label: string): Promise<void> {
  const enabled = String(process.env.STEP_BY_STEP ?? '1').toLowerCase();
  if (!['1', 'true', 'yes', 'y', 'on'].includes(enabled)) return;
  await waitForEnter(`Checkpoint: ${label}. Pulsa ENTER para continuar...`);
}

async function keepPageOpenByTimer(page: { waitForTimeout: (ms: number) => Promise<void> }) {
  const keepOpenSeconds = Number(process.env.KEEP_OPEN_SECONDS ?? '900');
  const seconds = Number.isFinite(keepOpenSeconds) && keepOpenSeconds > 0 ? keepOpenSeconds : 900;
  logger.info(`Manteniendo la página abierta ${seconds}s... (configurable con KEEP_OPEN_SECONDS)`);
  for (let i = seconds; i >= 1; i -= 1) {
    if (i <= 10 || i % 60 === 0) {
      logger.muted(`Se cerrará en ${i}s`);
    }
    await page.waitForTimeout(1000);
  }
}

const STEPS = {
  loadCookies: 'Cargar cookies guardadas (si existen)',
  verifySession: 'Verificar si la sesión es válida',
  ensureSession: 'Asegurar sesión válida (login si hace falta)',
  viewAllCars: 'Abrir "Ver todos los coches"',
  openBrand: 'Abrir filtro "Marca"',
  viewAllBrands: 'Pulsar "Ver todas las marcas"',
  reopenBrand: 'Pulsar en Marca de nuevo (reabrir desplegable; workaround: se cierra al pulsar "Ver todas las marcas")',
  selectBrandOpel: 'Seleccionar marca Opel',
  listModels: 'Listar los modelos visibles (Opel Corsa, Opel Frontera, Opel MOKA, etc.)',
  exchangeType: 'Pulsar en tipo de cambio',
  selectManualTransmission: 'Seleccionar cambio manual',
  keepOpen: 'Mantener la página abierta (antes de cerrar)',
} as const;

test('Ver todos los coches (con sesión/cookies si existen)', async ({ page }) => {
  // Dejamos margen amplio para que puedas inspeccionar el flujo sin que Playwright cierre el navegador por timeout.
  test.setTimeout(30 * 60 * 1000);
  const loginPage = new LoginPage(page);
  const carsPage = new CarsPage(page);
  let needsLogin = true;
  const totalSteps = 12;

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
      // Con cookies válidas, entramos al dashboard directamente
      await loginPage.gotoDashboard();
    }

    // En ambos casos: si aparece popup de cookies, lo aceptamos
    await loginPage.tryAcceptCookieConsent();
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
    await page.waitForTimeout(500);
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
    await page.waitForTimeout(800);
    const clickOpt = { timeout: 5_000, noWaitAfter: true } as const;
    if (process.env.BRAND_LOCATOR) {
      await page.locator(process.env.BRAND_LOCATOR).first().click({ ...clickOpt, timeout: 10_000 });
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
    await page.waitForTimeout(400);
    await carsPage.selectBrand('Opel', {
      locatorOverride: process.env.BRAND_OPEL_LOCATOR,
      testId: process.env.BRAND_OPEL_TESTID,
    });
    logger.success('Marca Opel seleccionada.');
  });

  await test.step(STEPS.listModels, async () => {
    logger.step(9, totalSteps, STEPS.listModels);
    await page.waitForTimeout(1500);
    const modelsWithPrices = await carsPage.getVisibleModelsWithPrices({ brandName: 'Opel' });
    logger.info(`Coches visibles (${modelsWithPrices.length}): Opel + modelo (Frontera, Mokka, …) y precio`);
    modelsWithPrices.forEach((item, i) => logger.muted(`  ${i + 1}. ${item.model} - ${item.price}`));
    logger.success('Listado de modelos y precios obtenido.');
  });

  await test.step(STEPS.exchangeType, async () => {
    logger.step(10, totalSteps, STEPS.exchangeType);
    await page.waitForTimeout(400);
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
    await page.waitForTimeout(100);
    await carsPage.selectExchangeTypeOption('Manual', {
      locatorOverride: process.env.EXCHANGE_TYPE_OPTION_LOCATOR,
      testId: process.env.EXCHANGE_TYPE_OPTION_TESTID,
    });
    logger.success('Manual seleccionado en tipo de cambio.');
  });

  await test.step(STEPS.keepOpen, async () => {
    logger.step(12, totalSteps, STEPS.keepOpen);
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

