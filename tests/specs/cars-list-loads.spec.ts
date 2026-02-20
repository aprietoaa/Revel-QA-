import { test } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { CarsPage } from '../pages/cars-page';
import { PHONE, OTP } from '../config';
import { loadCookies, saveCookies } from '../utils/cookies';
import { logger } from '../utils/logger';

/**
 * Listado de coches – carga con sesión, recorre TODAS las marcas y genera informe.
 * Pulsa "Ver todas las marcas" para descubrir la lista completa; por cada marca: selecciona, guarda modelos con precio, borra filtros.
 * Al final imprime un informe estructurado (modelo y precio por marca).
 */
test('Listado de coches: sesión, todas las marcas, guardar modelos e informe', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000); // hasta 30 min si hay muchas marcas
  const loginPage = new LoginPage(page);
  const carsPage = new CarsPage(page);
  let needsLogin = true;
  /** Marca -> lista de { model, price } */
  const informePorMarca: Record<string, Array<{ model: string; price: string }>> = {};
  /** Marcas en las que falló el flujo (para listarlas en el informe) */
  const marcasOmitidas: string[] = [];

  await test.step('Cargar cookies y verificar sesión', async () => {
    const cookiesLoaded = await loadCookies(page);
    if (cookiesLoaded) needsLogin = false;
    if (!needsLogin) {
      const isValid = await loginPage.isSessionValid();
      if (!isValid) needsLogin = true;
      else logger.success('Sesión válida.');
    }
  });

  await test.step('Asegurar sesión válida (login si hace falta)', async () => {
    if (needsLogin) {
      logger.info('Se hará login (captcha manual + OTP).');
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
      logger.warn('Sesión no válida tras cookies. Se hará login.');
      await loginPage.performFullLogin(PHONE, OTP);
      await loginPage.gotoDashboard();
      await saveCookies(page);
      await loginPage.tryAcceptCookieConsent();
      await loginPage.assertLoggedInAndGetInitials();
    }
  });

  await test.step('Ir al listado de coches', async () => {
    await loginPage.clickViewAllCars();
    logger.success(`Navegado a: ${page.url()}`);
  });

  await test.step('Verificar que el listado cargó', async () => {
    await carsPage.waitForGridVisible({ timeout: 15_000 });
    logger.success('Listado visible.');
  });

  const marcasAUsar = await test.step('Descubrir todas las marcas (Ver todas las marcas)', async () => {
    await carsPage.openBrandFilter({
      locatorOverride: process.env.BRAND_LOCATOR,
      testId: process.env.BRAND_TESTID,
    });
    await carsPage.clickViewAllBrands({ locatorOverride: process.env.VIEW_ALL_BRANDS_LOCATOR });
    await carsPage.reopenBrandFilter({ locatorOverride: process.env.BRAND_LOCATOR });
    const todasLasMarcas = await carsPage.getAvailableBrands({ timeout: 10_000 });
    await page.keyboard.press('Escape').catch(() => {});
    await page.getByText(/ver menos/i).first().click({ timeout: 2_000 }).catch(() => {});
    if (todasLasMarcas.length === 0) throw new Error('No hay marcas disponibles.');
    const soloMarcas = todasLasMarcas.filter(
      (m) => !/^pick-up$|^pick up$|^berlina$|^monovolumen$/i.test(m.trim())
    );
    logger.success(`Hemos encontrado ${soloMarcas.length} marcas (${todasLasMarcas.length - soloMarcas.length} no-marcas excluidas).`);
    logger.info('Estamos buscando vehículos en todas las marcas…');
    return soloMarcas;
  });

  const totalMarcas = marcasAUsar.length;

  for (let i = 0; i < marcasAUsar.length; i++) {
    const marca = marcasAUsar[i];
    const n = i + 1;
    await test.step(`[ ${n}/${totalMarcas} ] ${marca} – seleccionar, listar modelos, borrar filtros`, async () => {
      logger.muted(`  ► ${n}/${totalMarcas}  ${marca} – buscando vehículos…`);
      try {
        await carsPage.reopenBrandFilter({ locatorOverride: process.env.BRAND_LOCATOR });
        const linkVerTodas = page.getByText(/ver todas las marcas/i).first();
        const yaEstanTodas = await linkVerTodas.waitFor({ state: 'visible', timeout: 2_000 }).then(() => false).catch(() => true);
        if (!yaEstanTodas) {
          await carsPage.clickViewAllBrands({ locatorOverride: process.env.VIEW_ALL_BRANDS_LOCATOR });
          await carsPage.reopenBrandFilter({ locatorOverride: process.env.BRAND_LOCATOR });
        }
        await carsPage.selectBrand(marca);
        await carsPage.waitForGridVisible({ timeout: 8_000 });
        const items = await carsPage.getVisibleModelsWithPrices({
          brandName: marca,
          maxItems: 25,
          timeout: 6_000,
        });
        informePorMarca[marca] = items;
        if (items.length === 0) {
          logger.warn(`  ⚠ ${n}/${totalMarcas}  ${marca}: 0 vehículos listados – puede que las cards no cargaran (página lenta o vacía)`);
        } else {
          logger.success(`  ✓ ${n}/${totalMarcas}  ${marca}: ${items.length} vehículos`);
        }
        items.forEach((it, idx) => logger.muted(`      ${idx + 1}. ${it.model}  –  ${it.price}`));
        await carsPage.clearFilters({ locatorOverride: process.env.CLEAR_FILTERS_LOCATOR });
        await carsPage.waitForGridVisible({ timeout: 6_000 });
      } catch (err) {
        marcasOmitidas.push(marca);
        logger.warn(`  ✗ ${n}/${totalMarcas}  ${marca}: omitida (${String(err).slice(0, 80)}…)`);
      }
    });
  }

  await test.step('Informe final: modelos con precio por marca', async () => {
    const totalModelos = Object.values(informePorMarca).reduce((sum, list) => sum + list.length, 0);
    const line = '────────────────────────────────────────────────────';

    logger.success('');
    logger.success(line);
    logger.success('  INFORME: Modelo y precio por marca');
    logger.success(line);
    logger.info(`  Marcas procesadas: ${Object.keys(informePorMarca).length}`);
    if (marcasOmitidas.length > 0) {
      logger.warn(`  Marcas omitidas (error en flujo): ${marcasOmitidas.join(', ')}`);
    }
    logger.info(`  Total de modelos listados: ${totalModelos}`);
    logger.success(line);

    for (const [marca, items] of Object.entries(informePorMarca)) {
      logger.info(`  Marca: ${marca} (${items.length} modelos)`);
      items.forEach((it, idx) =>
        logger.muted(`    ${String(idx + 1).padStart(2)}. ${it.model}  –  ${it.price}`)
      );
      logger.muted('');
    }

    logger.success(line);
    logger.success('  Resumen');
    logger.success(line);
    for (const [marca, items] of Object.entries(informePorMarca)) {
      logger.info(`  • ${marca}: ${items.length} modelos`);
    }
    logger.info(`  TOTAL: ${totalModelos} modelos en ${Object.keys(informePorMarca).length} marcas`);
    logger.success(line);
    logger.success('');
  });

  await test.step('Informe: precios ordenados de mayor a menor', async () => {
    const line = '────────────────────────────────────────────────────';
    const flat: Array<{ model: string; price: string; marca: string; priceNum: number }> = [];
    const parsePrecioEuropeo = (s: string): number => {
      const numMatch = s.match(/(\d[\d.,]*)/);
      if (!numMatch) return 0;
      const raw = numMatch[1];
      const sinMiles = raw.replace(/\./g, '').replace(',', '.');
      return parseFloat(sinMiles) || 0;
    };
    for (const [marca, items] of Object.entries(informePorMarca)) {
      for (const it of items) {
        const priceNum = parsePrecioEuropeo(it.price);
        flat.push({ model: it.model, price: it.price, marca, priceNum });
      }
    }
    flat.sort((a, b) => b.priceNum - a.priceNum);

    logger.success('');
    logger.success(line);
    logger.success('  INFORME: Precios de mayor a menor');
    logger.success(line);
    logger.info(`  Total: ${flat.length} vehículos`);
    logger.success(line);
    flat.forEach((it, idx) =>
      logger.muted(`  ${String(idx + 1).padStart(3)}. ${it.price.padEnd(18)}  ${it.model}  (${it.marca})`)
    );
    logger.success(line);
    logger.success('');
  });
});
