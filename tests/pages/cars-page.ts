import { expect, Page } from '@playwright/test';
import { logger } from '../utils/logger';

export class CarsPage {
  constructor(private readonly page: Page) {}

  async openBrandFilter(options?: {
    timeout?: number;
    locatorOverride?: string;
    testId?: string;
    /** Texto que debe aparecer cuando el filtro Marca está abierto */
    openedIndicator?: RegExp;
    /** Si true, solo hace click en Marca sin esperar el desplegable (útil al reabrir en paso 7) */
    skipAssertOpened?: boolean;
  }) {
    const timeout = options?.timeout ?? 30_000;
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());
    const openedIndicator = options?.openedIndicator ?? /seleccionar todas las marcas/i;

    const assertOpened = async () => {
      // Señal de que el desplegable de Marca se abrió: "Ver todas las marcas" o "Seleccionar todas las marcas"
      const verTodas = this.page.getByText(/ver todas las marcas/i).first();
      const seleccionarTodas = this.page.getByText(openedIndicator).first();
      await Promise.race([
        verTodas.waitFor({ state: 'visible', timeout: 4_000 }),
        seleccionarTodas.waitFor({ state: 'visible', timeout: 4_000 }),
      ]);
      logger.success('Filtro Marca abierto correctamente.');
    };

    if (options?.locatorOverride) {
      const target = this.page.locator(options.locatorOverride).first();
      if (debug) logger.info(`Abriendo filtro Marca con locatorOverride: ${options.locatorOverride}`);
      await expect(target).toBeVisible({ timeout });
      await target.scrollIntoViewIfNeeded();
      await target.click({ timeout });
      if (!options?.skipAssertOpened) await assertOpened();
      return;
    }

    // Orden: primero selector estable del filtro Marca (FilterShortcutButton_filter__button__ZCF57 > p)
    const candidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId
        ? [{ name: `testid=${options.testId}`, locator: this.page.getByTestId(options.testId) }]
        : []),
      {
        name: 'div.FilterShortcutButton_filter__button__ZCF57 > p (Marca)',
        locator: this.page.locator('div.FilterShortcutButton_filter__button__ZCF57').filter({ has: this.page.locator('p', { hasText: /marca/i }) }).locator('p'),
      },
      { name: 'p[class*="Text_label"]:has-text("Marca")', locator: this.page.locator('p[class*="Text_label"]').filter({ hasText: /marca/i }) },
      { name: 'role=button[name~="Marca"]', locator: this.page.getByRole('button', { name: /marca/i }) },
      { name: 'role=combobox[name~="Marca"]', locator: this.page.getByRole('combobox', { name: /marca/i }) },
      { name: 'label="Marca"', locator: this.page.getByLabel(/marca/i) },
      { name: 'text="Marca"', locator: this.page.getByText(/^marca$/i) },
      { name: '[aria-label*="Marca"]', locator: this.page.locator('[aria-label*="Marca" i]') },
    ];

    const fastTimeout = 8_000; // fallar rápido si el candidato no aplica
    let lastError: unknown = null;
    for (const c of candidates) {
      try {
        const target = c.locator.first();
        if (debug) {
          const count = await c.locator.count().catch(() => 0);
          logger.info(`Abriendo filtro Marca: ${c.name} (matches: ${count})`);
        }
        await expect(target).toBeVisible({ timeout: fastTimeout });
        await target.scrollIntoViewIfNeeded();

        // Debug opcional: qué hay encima en el punto medio
        if (debug) {
          const box = await target.boundingBox();
          if (box) {
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            const top = await this.page
              .evaluate(({ x, y }) => {
                const el = document.elementFromPoint(x, y) as HTMLElement | null;
                if (!el) return null;
                const text = (el.innerText || el.textContent || '').trim().slice(0, 120);
                return {
                  tag: el.tagName,
                  id: el.id || null,
                  className: el.className ? String(el.className).slice(0, 120) : null,
                  text: text || null,
                };
              }, { x, y })
              .catch(() => null);
            if (top) {
              logger.muted(
                `Marca: elemento encima (center point): <${top.tag.toLowerCase()}> id=${top.id ?? '-'} class=${top.className ?? '-'} text=${top.text ?? '-'}`
              );
            }
          }
        }

        // Si target es un <p> o un wrapper, clicamos el ancestro clicable más cercano.
        const clickableAncestor = target.locator(
          'xpath=ancestor-or-self::*[self::button or self::a or @role="button" or @role="combobox"][1]'
        );
        if ((await clickableAncestor.count().catch(() => 0)) > 0) {
          await clickableAncestor.first().click({ timeout: fastTimeout });
        } else {
          try {
            await target.click({ timeout: fastTimeout });
          } catch (error) {
            if (debug) logger.warn(`Click normal falló (${c.name}). Reintentando con force...`);
            await target.click({ timeout: fastTimeout, force: true });
          }

          // Último recurso: buscar ancestro con cursor:pointer y clicar vía DOM.
          const handle = await target.elementHandle();
          if (handle) {
            const clicked = await this.page.evaluate((el) => {
              const isClickable = (node: Element) => {
                const tag = node.tagName.toLowerCase();
                const role = (node.getAttribute('role') || '').toLowerCase();
                const cursor = window.getComputedStyle(node).cursor;
                return (
                  tag === 'button' ||
                  tag === 'a' ||
                  role === 'button' ||
                  role === 'combobox' ||
                  cursor === 'pointer' ||
                  node.hasAttribute('onclick')
                );
              };

              let cur: Element | null = el;
              for (let i = 0; i < 8 && cur; i += 1) {
                if (isClickable(cur)) {
                  (cur as HTMLElement).click();
                  return true;
                }
                cur = cur.parentElement;
              }
              return false;
            }, handle);
            if (clicked) {
              if (debug) logger.success('Filtro Marca clicado via ancestro (cursor/onclick/role)');
            }
          }
        }

        // Validación: solo aceptamos que funcionó si aparece el indicador del desplegable abierto (salvo al reabrir)
        if (!options?.skipAssertOpened) await assertOpened();
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo abrir Marca con ${c.name}, probando otra opción...`);
      }
    }

    // Captura para diagnóstico rápido
    await this.page.screenshot({ path: 'tests/artifacts/open-brand-fail.png', fullPage: true }).catch(() => {});
    throw new Error(`No se pudo abrir el filtro "Marca". Último error: ${String(lastError)}`);
  }

  /**
   * Clic en "Ver todas las marcas" dentro del desplegable de Marca.
   * Elemento real: <p class="Text_link__dt6nf gray-100 mt-tiny Text_underline__VFqPP Text_text-ellipsis__OyhMd">Ver todas las marcas</p>
   */
  async clickViewAllBrands(options?: { timeout?: number; locatorOverride?: string; testId?: string }) {
    const timeout = options?.timeout ?? 15_000;
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());
    const fastTimeout = 10_000;

    if (options?.locatorOverride) {
      const target = this.page.locator(options.locatorOverride).first();
      if (debug) logger.info(`Ver todas las marcas con locatorOverride: ${options.locatorOverride}`);
      await expect(target).toBeVisible({ timeout });
      await target.scrollIntoViewIfNeeded();
      await target.click({ timeout, noWaitAfter: true });
      return;
    }

    // Selector exacto del elemento que pasaste: p con Text_link__ + Text_underline__
    const candidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId ? [{ name: `testid=${options.testId}`, locator: this.page.getByTestId(options.testId) }] : []),
      {
        name: 'p.Text_link + Text_underline (exacto)',
        locator: this.page.locator('p[class*="Text_link__"][class*="Text_underline__"]').filter({ hasText: /ver todas las marcas/i }),
      },
      { name: 'p[class*="Text_link"]', locator: this.page.locator('p[class*="Text_link"]').filter({ hasText: /ver todas las marcas/i }) },
      { name: 'role=link', locator: this.page.getByRole('link', { name: /ver todas las marcas/i }) },
      { name: 'text="Ver todas las marcas"', locator: this.page.getByText(/ver todas las marcas/i).first() },
    ];

    const clickOpt = { timeout: fastTimeout, noWaitAfter: true } as const;
    let lastError: unknown = null;
    for (const c of candidates) {
      try {
        const target = c.locator.first();
        await expect(target).toBeVisible({ timeout: fastTimeout });
        await target.scrollIntoViewIfNeeded();

        const clickableAncestor = target.locator(
          'xpath=ancestor-or-self::*[self::button or self::a or @role="button" or @role="link"][1]'
        );
        if ((await clickableAncestor.count().catch(() => 0)) > 0) {
          await clickableAncestor.first().click(clickOpt);
        } else {
          try {
            await target.click(clickOpt);
          } catch {
            await target.click({ ...clickOpt, force: true });
          }
          const handle = await target.elementHandle();
          if (handle) {
            await this.page.evaluate((el) => {
              const isClickable = (node: Element) => {
                const tag = node.tagName.toLowerCase();
                const role = (node.getAttribute('role') || '').toLowerCase();
                const cursor = window.getComputedStyle(node).cursor;
                return (
                  tag === 'button' || tag === 'a' ||
                  role === 'button' || role === 'link' ||
                  cursor === 'pointer' || node.hasAttribute('onclick')
                );
              };
              let cur: Element | null = el;
              for (let i = 0; i < 8 && cur; i += 1) {
                if (isClickable(cur)) {
                  (cur as HTMLElement).click();
                  return;
                }
                cur = cur.parentElement;
              }
              (el as HTMLElement).click();
            }, handle);
          }
        }
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo clicar "Ver todas las marcas" con ${c.name}.`);
      }
    }

    await this.page.screenshot({ path: 'tests/artifacts/view-all-brands-fail.png', fullPage: true }).catch(() => {});
    throw new Error(`No se pudo clicar "Ver todas las marcas". Último error: ${String(lastError)}`);
  }

  /**
   * Pulsa en el filtro "Tipo de cambio" (misma barra de filtros que Marca).
   * XPath de referencia: /html/body/div[8]/div/div/div[1]/div/div/div[2]/div[5]/div[1]/p
   * Prioriza: data-testid, texto, clase estable FilterShortcutButton.
   */
  async clickExchangeTypeFilter(options?: { timeout?: number; locatorOverride?: string; testId?: string }) {
    const timeout = options?.timeout ?? 15_000;
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());
    const fastTimeout = 8_000;
    const clickOpt = { timeout: fastTimeout, noWaitAfter: true } as const;

    const locatorOverride = options?.locatorOverride ?? process.env.EXCHANGE_TYPE_LOCATOR;
    if (locatorOverride) {
      const selector =
        locatorOverride.startsWith('/') || locatorOverride.startsWith('(/')
          ? `xpath=${locatorOverride}`
          : locatorOverride;
      const target = this.page.locator(selector).first();
      if (debug) logger.info(`Tipo de cambio con locatorOverride: ${locatorOverride}`);
      await expect(target).toBeVisible({ timeout });
      await target.scrollIntoViewIfNeeded();
      await target.click(clickOpt);
      return;
    }

    const candidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId
        ? [{ name: `testid=${options.testId}`, locator: this.page.getByTestId(options.testId) }]
        : []),
      {
        name: 'div.FilterShortcutButton con "tipo de cambio"',
        locator: this.page
          .locator('div.FilterShortcutButton_filter__button__ZCF57')
          .filter({ has: this.page.locator('p', { hasText: /tipo de cambio/i }) })
          .locator('p'),
      },
      { name: 'p[class*="Text_label"] tipo de cambio', locator: this.page.locator('p[class*="Text_label"]').filter({ hasText: /tipo de cambio/i }) },
      { name: 'text="Tipo de cambio"', locator: this.page.getByText(/tipo de cambio/i).first() },
      { name: 'role=button tipo de cambio', locator: this.page.getByRole('button', { name: /tipo de cambio/i }) },
    ];

    let lastError: unknown = null;
    for (const c of candidates) {
      try {
        const target = c.locator.first();
        await expect(target).toBeVisible({ timeout: fastTimeout });
        await target.scrollIntoViewIfNeeded();
        await target.click(clickOpt);
        logger.success('Filtro Tipo de cambio pulsado.');
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo clicar tipo de cambio con ${c.name}.`);
      }
    }

    await this.page.screenshot({ path: 'tests/artifacts/exchange-type-fail.png', fullPage: true }).catch(() => {});
    throw new Error(`No se pudo pulsar en "Tipo de cambio". Último error: ${String(lastError)}`);
  }

  /**
   * Overlay del filtro tipo de cambio (body > div[8], mismo que el XPath del paso 10).
   * Uso directo por índice para no depender de filter(hasText) que es lento.
   */
  private getExchangeTypeOverlay(): ReturnType<Page['locator']> {
    return this.page.locator('body > div').nth(7);
  }

  /**
   * Devuelve el panel desplegable de "Tipo de cambio" (fallback; más lento que getExchangeTypeOverlay).
   */
  getExchangeTypeDropdownPanel(): ReturnType<Page['locator']> {
    const byTestId = process.env.EXCHANGE_TYPE_PANEL_TESTID;
    if (byTestId) return this.page.getByTestId(byTestId);
    return this.getExchangeTypeOverlay();
  }

  /**
   * Selecciona una opción del menú "Tipo de cambio" (ej. "Manual").
   * Ruta rápida: overlay body > div[8] + texto exacto, con timeout corto (1,5 s por candidato).
   */
  async selectExchangeTypeOption(
    optionName: string,
    options?: { timeout?: number; locatorOverride?: string; testId?: string }
  ): Promise<void> {
    const timeout = options?.timeout ?? 6_000;
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());
    const re = new RegExp(optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const fastTimeout = 1_500;
    const clickOpt = { timeout: fastTimeout, noWaitAfter: true } as const;

    const locatorOverride = options?.locatorOverride ?? process.env.EXCHANGE_TYPE_OPTION_LOCATOR;
    if (locatorOverride) {
      const selector =
        locatorOverride.startsWith('/') || locatorOverride.startsWith('(/')
          ? `xpath=${locatorOverride}`
          : locatorOverride;
      const target = this.page.locator(selector).first();
      if (debug) logger.info(`Seleccionar "${optionName}" con locatorOverride`);
      await expect(target).toBeVisible({ timeout: Math.min(timeout, 4_000) });
      await target.scrollIntoViewIfNeeded();
      await target.click(clickOpt);
      return;
    }

    const overlay = this.getExchangeTypeOverlay();

    const fastCandidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      { name: `overlay + texto exacto "${optionName}"`, locator: overlay.getByText(optionName, { exact: true }).first() },
      { name: `overlay + texto "${optionName}"`, locator: overlay.getByText(re).first() },
      { name: `overlay + p "${optionName}"`, locator: overlay.locator('p').filter({ hasText: re }).first() },
    ];

    let lastError: unknown = null;
    for (const c of fastCandidates) {
      try {
        const target = c.locator;
        await expect(target).toBeVisible({ timeout: fastTimeout });
        await target.scrollIntoViewIfNeeded();
        await target.click(clickOpt);
        logger.success(`Opción "${optionName}" seleccionada en tipo de cambio.`);
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo con ${c.name}.`);
      }
    }

    const panel = this.getExchangeTypeDropdownPanel();
    const scopedCandidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId ? [{ name: `testid (en panel)`, locator: panel.getByTestId(options.testId!) }] : []),
      { name: `panel + texto exacto`, locator: panel.getByText(optionName, { exact: true }).first() },
      { name: `panel + role=option`, locator: panel.getByRole('option', { name: re }) },
      { name: `panel + role=menuitem`, locator: panel.getByRole('menuitem', { name: re }) },
    ];
    for (const c of scopedCandidates) {
      try {
        const target = c.locator.first();
        await expect(target).toBeVisible({ timeout: fastTimeout });
        await target.scrollIntoViewIfNeeded();
        await target.click(clickOpt);
        logger.success(`Opción "${optionName}" seleccionada en tipo de cambio.`);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    const pageCandidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      { name: `text="${optionName}"`, locator: this.page.getByText(re).first() },
      { name: `role=option`, locator: this.page.getByRole('option', { name: re }) },
    ];
    for (const c of pageCandidates) {
      try {
        const target = c.locator.first();
        await expect(target).toBeVisible({ timeout: fastTimeout });
        await target.scrollIntoViewIfNeeded();
        await target.click(clickOpt);
        logger.success(`Opción "${optionName}" seleccionada.`);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(`No se pudo seleccionar "${optionName}" en tipo de cambio. Último error: ${String(lastError)}`);
  }

  /**
   * Devuelve un locator del panel desplegable de marcas (el que tiene la cuadrícula de marcas y "Ver menos" abajo).
   * Prioriza: data-testid, overlay que contiene "Ver menos" (panel de la imagen), luego body > div[8], roles, contenido.
   */
  getBrandDropdownPanel(): ReturnType<Page['locator']> {
    const byTestId = process.env.BRAND_DROPDOWN_TESTID;
    if (byTestId) {
      return this.page.getByTestId(byTestId);
    }
    // Panel que tiene "Ver menos" = el desplegable de marcas expandido (cuadrícula Audi, Byd, ... Opel, ...)
    const panelWithVerMenos = this.page
      .locator('body > div')
      .filter({ hasText: /Ver menos/i })
      .first();
    // Overlay body > div[8] (xpath conocido) si contiene el panel de marcas
    const overlay = this.page
      .locator('body > div')
      .nth(7)
      .filter({ hasText: /seleccionar todas las marcas|Ver menos/i });
    const rolePanel = this.page
      .getByRole('listbox')
      .or(this.page.getByRole('dialog'))
      .or(this.page.getByRole('menu'))
      .filter({ hasText: /seleccionar todas las marcas/i })
      .first();
    const byContent = this.page
      .locator('div')
      .filter({ has: this.page.getByText(/seleccionar todas las marcas/i) })
      .first();
    return panelWithVerMenos.or(overlay).or(rolePanel).or(byContent);
  }

  /**
   * Selecciona una marca por nombre (ej. Opel) **dentro del desplegable de marcas**.
   * Así se evita pulsar un "Opel" que esté en otra parte de la página.
   * Prioriza: data-testid, roles, texto/clase dentro del panel.
   */
  async selectBrand(
    brandName: string,
    options?: { timeout?: number; locatorOverride?: string; testId?: string }
  ) {
    const timeout = options?.timeout ?? 15_000;
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());
    const re = new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    if (options?.locatorOverride) {
      const target = this.page.locator(options.locatorOverride).first();
      if (debug) logger.info(`Seleccionar marca ${brandName} con locatorOverride`);
      await expect(target).toBeVisible({ timeout });
      await target.scrollIntoViewIfNeeded();
      await target.click({ timeout, noWaitAfter: true });
      return;
    }

    const panel = this.getBrandDropdownPanel();
    const clickOpt = { timeout: 8_000, noWaitAfter: true } as const;

    // 1) Dentro del panel de marcas (cuadrícula con Audi, Byd, ... Opel, ...): clic en la celda que contiene la marca
    const scopedCandidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId
        ? [{ name: `testid=${options.testId} (en panel)`, locator: panel.getByTestId(options.testId) }]
        : []),
      { name: `celda con "${brandName}" (padre del p, cuadrícula)`, locator: panel.getByText(brandName, { exact: true }).locator('xpath=..').first() },
      { name: `text exacto "${brandName}" (en panel)`, locator: panel.getByText(brandName, { exact: true }).first() },
      { name: `role=menuitem[name="${brandName}"] (en panel)`, locator: panel.getByRole('menuitem', { name: re }) },
      { name: `role=option[name="${brandName}"] (en panel)`, locator: panel.getByRole('option', { name: re }) },
      { name: `role=button[name="${brandName}"] (en panel)`, locator: panel.getByRole('button', { name: re }) },
      { name: `text="${brandName}" (en panel)`, locator: panel.getByText(re).first() },
      { name: 'p[class*="Text_regular__"] exacto (en panel)', locator: panel.locator('p[class*="Text_regular__"]').filter({ hasText: new RegExp(`^${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }) },
      { name: 'p[class*="Text_regular__"] (en panel)', locator: panel.locator('p[class*="Text_regular__"]').filter({ hasText: re }) },
    ];

    let lastError: unknown = null;
    for (const c of scopedCandidates) {
      try {
        const target = c.locator.first();
        if (debug) {
          const count = await c.locator.count().catch(() => 0);
          logger.info(`Seleccionar ${brandName}: ${c.name} (matches: ${count})`);
        }
        await expect(target).toBeVisible({ timeout: 8_000 });
        await target.scrollIntoViewIfNeeded();
        await target.click(clickOpt);
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo clicar ${brandName} con ${c.name}.`);
      }
    }

    // 2) Fallback a nivel página (por si el panel no se resuelve con los selectores anteriores)
    const pageCandidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      { name: `role=menuitem[name="${brandName}"]`, locator: this.page.getByRole('menuitem', { name: re }) },
      { name: `role=link[name="${brandName}"]`, locator: this.page.getByRole('link', { name: re }) },
      { name: `text="${brandName}"`, locator: this.page.getByText(re).first() },
      { name: 'p[class*="Text_regular__"]', locator: this.page.locator('p[class*="Text_regular__"]').filter({ hasText: re }) },
    ];
    for (const c of pageCandidates) {
      try {
        const target = c.locator.first();
        await expect(target).toBeVisible({ timeout: 8_000 });
        await target.scrollIntoViewIfNeeded();
        await target.click(clickOpt);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(`No se pudo seleccionar la marca "${brandName}". Último error: ${String(lastError)}`);
  }

  async selectAllBrands(options?: { timeout?: number; locatorOverride?: string; testId?: string }) {
    const timeout = options?.timeout ?? 30_000;
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());
    const fastTimeout = 10_000;

    if (options?.locatorOverride) {
      const target = this.page.locator(options.locatorOverride).first();
      if (debug) logger.info(`Seleccionando todas las marcas con locatorOverride: ${options.locatorOverride}`);
      await expect(target).toBeVisible({ timeout });
      await target.scrollIntoViewIfNeeded();
      await target.click({ timeout });
      return;
    }

    // Varios candidatos: texto, role, y clases tipo Text_link__/Text_label__ por si es un <p> como los demás
    const candidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId
        ? [{ name: `testid=${options.testId}`, locator: this.page.getByTestId(options.testId) }]
        : []),
      { name: 'text="Seleccionar todas las marcas"', locator: this.page.getByText(/seleccionar todas las marcas/i).first() },
      { name: 'p[class*="Text_link"]', locator: this.page.locator('p[class*="Text_link"]').filter({ hasText: /seleccionar todas las marcas/i }) },
      { name: 'p[class*="Text_label"]', locator: this.page.locator('p[class*="Text_label"]').filter({ hasText: /seleccionar todas las marcas/i }) },
      { name: 'role=button', locator: this.page.getByRole('button', { name: /seleccionar todas las marcas/i }) },
      { name: 'role=menuitem', locator: this.page.getByRole('menuitem', { name: /seleccionar todas las marcas/i }) },
      { name: 'role=link', locator: this.page.getByRole('link', { name: /seleccionar todas las marcas/i }) },
      { name: 'label', locator: this.page.getByLabel(/seleccionar todas las marcas/i) },
    ];

    let lastError: unknown = null;
    for (const c of candidates) {
      try {
        const target = c.locator.first();
        if (debug) {
          const count = await c.locator.count().catch(() => 0);
          logger.info(`Seleccionar todas las marcas: ${c.name} (matches: ${count})`);
        }
        await expect(target).toBeVisible({ timeout: fastTimeout });
        await target.scrollIntoViewIfNeeded();

        const clickableAncestor = target.locator(
          'xpath=ancestor-or-self::*[self::button or self::a or @role="button" or @role="menuitem" or @role="link"][1]'
        );
        if ((await clickableAncestor.count().catch(() => 0)) > 0) {
          await clickableAncestor.first().click({ timeout: fastTimeout });
        } else {
          try {
            await target.click({ timeout: fastTimeout });
          } catch {
            await target.click({ timeout: fastTimeout, force: true });
          }
          const handle = await target.elementHandle();
          if (handle) {
            const clicked = await this.page.evaluate((el) => {
              const isClickable = (node: Element) => {
                const tag = node.tagName.toLowerCase();
                const role = (node.getAttribute('role') || '').toLowerCase();
                const cursor = window.getComputedStyle(node).cursor;
                return (
                  tag === 'button' || tag === 'a' ||
                  role === 'button' || role === 'menuitem' || role === 'link' ||
                  cursor === 'pointer' || node.hasAttribute('onclick')
                );
              };
              let cur: Element | null = el;
              for (let i = 0; i < 8 && cur; i += 1) {
                if (isClickable(cur)) {
                  (cur as HTMLElement).click();
                  return true;
                }
                cur = cur.parentElement;
              }
              return false;
            }, handle);
            if (!clicked && debug) logger.muted('No se encontró ancestro clicable para DOM click');
          }
        }
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo con ${c.name}. Probando siguiente...`);
      }
    }

    await this.page.screenshot({ path: 'tests/artifacts/select-all-brands-fail.png', fullPage: true }).catch(() => {});
    throw new Error(`No se pudo clicar "Seleccionar todas las marcas". Último error: ${String(lastError)}`);
  }

  /**
   * Lista los nombres de modelo visibles en la página (p. ej. tras filtrar por Opel).
   * @returns Array de strings con los nombres mostrados (sin deduplicar: 5 cards => 5 entradas).
   */
  async getVisibleModelNames(options?: {
    brandName?: string;
    timeout?: number;
    listTestId?: string;
    cardTestId?: string;
  }): Promise<string[]> {
    const items = await this.getVisibleModelsWithPrices(options);
    return items.map((x) => x.model);
  }

  /** Hace scroll para que el listado de coches quede visible. Espera a que al menos una card esté visible. */
  async scrollResultsIntoView(options?: { behavior?: 'auto' | 'smooth' }): Promise<void> {
    const behavior = options?.behavior ?? 'auto';
    await this.page.evaluate((b: ScrollBehavior) => window.scrollBy({ top: 450, behavior: b }), behavior);
    await this.page.locator('article, [role="listitem"]').first().waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});
  }

  /** Patrón para extraer precio: "299 €/mes", "299€", "299 €", etc. */
  private static readonly PRICE_PATTERN = /(\d[\d.,]*)\s*€(\s*\/\s*mes)?/;

  /** Etiquetas que no son modelo: no usar como nombre ni mostrar en el listado. */
  private static readonly LABEL_EXCLUDE = /^(Rebajas?|Nuevo\s*a\s*estrenar|Nuevo)$/i;
  /** Quitar del texto mostrado: solo Opel + modelo (Frontera, Mokka, ...). */
  private static readonly STRIP_FROM_MODEL = /\s*(Rebajas?|Nuevo\s*a\s*estrenar|Nuevo)\s*/gi;
  /** Dejar solo letras, números y espacios en el modelo (quitar 🚨, €, etc.). */
  private static readonly MODEL_CLEAN = /[^\p{L}\p{N}\s]/gu;
  /** Patrón para "Opel" + nombre de modelo (Corsa, Frontera, MOKA, …) en el texto de la card. */
  private static getBrandPlusModel(brand: string): RegExp {
    const esc = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`${esc}\\s+([A-Za-z0-9áéíóúÁÉÍÓÚñÑ\\s]+?)(?=\\s*\\d|\\s*€|\\n|$)`, 'i');
  }

  /**
   * Lista modelo y precio de cada coche visible (por card, sin deduplicar: 5 cards => 5 entradas).
   * Prioriza: data-testid, luego article/listitem/cards por contenedor.
   */
  async getVisibleModelsWithPrices(options?: {
    brandName?: string;
    timeout?: number;
    listTestId?: string;
    cardTestId?: string;
  }): Promise<Array<{ model: string; price: string }>> {
    const timeout = options?.timeout ?? 10_000;
    const brandName = options?.brandName ?? '';
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());

    await this.scrollResultsIntoView();

    const listTestId = options?.listTestId ?? process.env.CAR_LIST_TESTID;
    const cardTestId = options?.cardTestId ?? process.env.CAR_CARD_TESTID;

    const extractFromCards = async (cards: ReturnType<Page['locator']>): Promise<Array<{ model: string; price: string }>> => {
      const count = await cards.count();
      const out: Array<{ model: string; price: string }> = [];
      const brandNorm = brandName.trim();
      for (let i = 0; i < count; i += 1) {
        const card = cards.nth(i);
        await card.first().scrollIntoViewIfNeeded().catch(() => {});
        await card.first().waitFor({ state: 'visible', timeout: 1_000 }).catch(() => {});
        const text = await card.first().innerText().catch(() => '');
        const textClean = text.replace(CarsPage.MODEL_CLEAN, ' ').replace(/\s+/g, ' ').trim();
        const lines = text.trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
        let model = '';
        if (brandNorm) {
          const match = textClean.match(CarsPage.getBrandPlusModel(brandNorm));
          if (match) {
            model = `${brandNorm} ${match[1].trim()}`;
          }
        }
        if (!model) {
          for (const line of lines) {
            if (!line || CarsPage.LABEL_EXCLUDE.test(line)) continue;
            if (brandNorm && line.toLowerCase().includes(brandNorm.toLowerCase()) && /[A-Za-z]{2,}/.test(line.replace(brandNorm, ''))) {
              model = line;
              break;
            }
            if (line.length >= 2 && line.length <= 60) {
              model = model || line;
              break;
            }
          }
        }
        if (!model) model = (lines[0] ?? text.trim().slice(0, 80) ?? '').trim();
        if (CarsPage.LABEL_EXCLUDE.test(model) || !model) continue;
        if (brandNorm && !model.toLowerCase().startsWith(brandNorm.toLowerCase())) {
          model = `${brandNorm} ${model}`;
        }
        model = model.replace(CarsPage.STRIP_FROM_MODEL, ' ').replace(CarsPage.MODEL_CLEAN, ' ').replace(/\s+/g, ' ').trim();
        const priceMatch = text.match(CarsPage.PRICE_PATTERN);
        let price = '';
        if (priceMatch) {
          const num = priceMatch[1].replace(/\s/g, '');
          price = priceMatch[2] ? `${num} euros al mes` : `${num} €`;
        }
        if (!price) continue;
        out.push({ model, price });
      }
      return out;
    };

    if (listTestId) {
      const list = this.page.getByTestId(listTestId);
      await list.first().waitFor({ state: 'visible', timeout }).catch(() => {});
      const cards = cardTestId ? list.getByTestId(cardTestId) : list.locator('article, [role="listitem"], [data-testid*="card"], a[href*="coches"], a[href*="car"]');
      const result = CarsPage.limitToCarsOnly(await extractFromCards(cards), brandName);
      if (result.length > 0) {
        if (debug) logger.info(`getVisibleModelsWithPrices: ${result.length} cards (listTestId)`);
        return result;
      }
    }

    if (cardTestId) {
      const cards = this.page.getByTestId(cardTestId);
      await cards.first().waitFor({ state: 'visible', timeout }).catch(() => {});
      const result = CarsPage.limitToCarsOnly(await extractFromCards(cards), brandName);
      if (result.length > 0) {
        if (debug) logger.info(`getVisibleModelsWithPrices: ${result.length} cards (cardTestId)`);
        return result;
      }
    }

    const brandRe = brandName ? new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

    const cardCandidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      { name: 'role=article', locator: this.page.getByRole('article') },
      { name: 'role=listitem', locator: this.page.getByRole('listitem') },
      { name: 'a[href*="coches"], a[href*="car"]', locator: this.page.locator('a[href*="coches"], a[href*="car"]') },
      { name: 'div con título + precio (grid)', locator: this.page.locator('div').filter({ hasText: CarsPage.PRICE_PATTERN }) },
    ];

    const candidateTimeout = Math.min(timeout, 3_000);
    for (const c of cardCandidates) {
      try {
        const loc = brandRe ? c.locator.filter({ hasText: brandRe }) : c.locator;
        await loc.first().waitFor({ state: 'visible', timeout: candidateTimeout });
        const result = CarsPage.limitToCarsOnly(await extractFromCards(loc), brandName);
        if (result.length > 0) {
          if (debug) logger.info(`getVisibleModelsWithPrices: ${result.length} con ${c.name}`);
          return result;
        }
      } catch {
        // siguiente candidato
      }
    }

    const pricePatternStr = CarsPage.PRICE_PATTERN.source;
    const labelExcludeStr = CarsPage.LABEL_EXCLUDE.source;
    const stripFromModelStr = CarsPage.STRIP_FROM_MODEL.source;
    const modelCleanStr = CarsPage.MODEL_CLEAN.source;
    const brandPlusModelStr = CarsPage.getBrandPlusModel(brandName).source;
    const fallback = await this.page.evaluate(
      (opts: {
        brand: string;
        pricePattern: string;
        labelExclude: string;
        stripFromModel: string;
        modelClean: string;
        brandPlusModel: string;
      }) => {
        const main = document.querySelector('main') ?? document.body;
        const priceRe = new RegExp(opts.pricePattern, 'g');
        const labelRe = new RegExp(opts.labelExclude, 'i');
        const stripRe = new RegExp(opts.stripFromModel, 'gi');
        const cleanRe = new RegExp(opts.modelClean, 'gu');
        const brandModelRe = new RegExp(opts.brandPlusModel, 'i');
        const cards: Array<{ model: string; price: string }> = [];
        const selectors = 'article, [role="listitem"], a[href*="coches"], a[href*="car"]';
        main.querySelectorAll(selectors).forEach((el) => {
          const text = (el.textContent || '').trim();
          if (text.length < 4 || text.length > 500) return;
          if (opts.brand && !text.toLowerCase().includes(opts.brand.toLowerCase())) return;
          const priceMatch = text.match(priceRe);
          if (!priceMatch) return;
          const num = priceMatch[1].replace(/\s/g, '');
          const price = priceMatch[2] ? `${num} euros al mes` : `${num} €`;
          let model = '';
          const brandModelMatch = text.match(brandModelRe);
          if (brandModelMatch) {
            model = `${opts.brand} ${brandModelMatch[1].trim()}`;
          }
          if (!model) {
            const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
            for (const line of lines) {
              if (!line || labelRe.test(line)) continue;
              if (opts.brand && line.toLowerCase().includes(opts.brand.toLowerCase()) && line.replace(opts.brand, '').match(/[A-Za-z]{2,}/)) {
                model = line;
                break;
              }
              if (line.length >= 2 && line.length <= 60) {
                model = model || line;
                break;
              }
            }
            if (!model) model = lines[0] ?? text.slice(0, 80);
          }
          if (labelRe.test(model)) return;
          if (opts.brand && !model.toLowerCase().startsWith(opts.brand.toLowerCase())) {
            model = `${opts.brand} ${model}`;
          }
          model = model.replace(stripRe, ' ').replace(cleanRe, ' ').replace(/\s+/g, ' ').trim();
          cards.push({ model, price });
        });
        return cards;
      },
      {
        brand: brandName,
        pricePattern: pricePatternStr,
        labelExclude: labelExcludeStr,
        stripFromModel: stripFromModelStr,
        modelClean: modelCleanStr,
        brandPlusModel: brandPlusModelStr,
      }
    );

    if (fallback.length > 0) {
      if (debug) logger.info(`getVisibleModelsWithPrices: ${fallback.length} (fallback evaluate)`);
      return CarsPage.limitToCarsOnly(fallback, brandName);
    }

    logger.warn('No se encontraron modelos con precio visibles.');
    return [];
  }

  /**
   * Pulsa en la card del primer coche listado (por modelo, ej. "Opel Corsa").
   * No se filtra por precio para que siga funcionando cuando el precio cambie (322€/mes hoy, otro mañana).
   * Se busca la primera card que contiene el modelo y un precio (€ o /mes) para no pulsar otro elemento.
   */
  async clickFirstVisibleCar(options?: {
    timeout?: number;
    locatorOverride?: string;
    /** Modelo del primer ítem del listado (ej. "Opel Corsa"); el precio no se usa en el locator */
    firstListedModel?: string;
    firstListedPrice?: string;
  }): Promise<void> {
    const timeout = options?.timeout ?? 10_000;
    const clickOpt = { timeout: 5_000, noWaitAfter: true } as const;
    const model = (options?.firstListedModel ?? '').trim();
    const priceStr = (options?.firstListedPrice ?? '').trim();

    const locatorOverride = options?.locatorOverride ?? process.env.FIRST_CAR_LOCATOR;
    if (locatorOverride) {
      const selector =
        locatorOverride.startsWith('/') || locatorOverride.startsWith('(/')
          ? `xpath=${locatorOverride}`
          : locatorOverride;
      const target = this.page.locator(selector).first();
      await expect(target).toBeVisible({ timeout });
      await target.click(clickOpt);
      logger.success('Coche seleccionado.');
      return;
    }

    if (!model) {
      throw new Error('clickFirstVisibleCar: indica firstListedModel (ej. "Opel Corsa").');
    }

    const reModel = new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const hasPrice = /\d|€|\/mes/i;
    const fastTimeout = 2_000;
    const cardCandidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      { name: 'link', locator: this.page.getByRole('link', { name: reModel }) },
      { name: 'article', locator: this.page.getByRole('article').filter({ hasText: reModel }).filter({ hasText: hasPrice }) },
      { name: 'a coches', locator: this.page.locator('a[href*="coches"], a[href*="car"]').filter({ hasText: reModel }).filter({ hasText: hasPrice }) },
      { name: 'listitem', locator: this.page.getByRole('listitem').filter({ hasText: reModel }).filter({ hasText: hasPrice }) },
    ];

    for (const c of cardCandidates) {
      try {
        const first = c.locator.first();
        await expect(first).toBeVisible({ timeout: fastTimeout });
        await first.click(clickOpt);
        logger.success(`Pulsado en: ${model}${priceStr ? ` (${priceStr})` : ''}.`);
        return;
      } catch {
        // siguiente candidato
      }
    }

    const textFallback = this.page.getByText(reModel).first();
    try {
      await expect(textFallback).toBeVisible({ timeout: fastTimeout });
      const ancestor = textFallback.locator('xpath=ancestor::*[self::a or self::article or self::button or @role="button" or @role="link"][1]');
      if ((await ancestor.count()) > 0) {
        await ancestor.first().click(clickOpt);
      } else {
        await textFallback.click(clickOpt);
      }
      logger.success(`Pulsado en: ${model}.`);
      return;
    } catch {
      try {
        const first = cardCandidates[0].locator.first();
        await first.click({ ...clickOpt, force: true });
        logger.success(`Pulsado en: ${model} (force).`);
        return;
      } catch {
        // ignore
      }
    }

    throw new Error(`No se encontró la card del coche "${model}".`);
  }

  /** Devuelve solo entradas que son coches (marca + precio), máximo 4 cuando hay marca. */
  private static limitToCarsOnly(
    items: Array<{ model: string; price: string }>,
    brandName: string
  ): Array<{ model: string; price: string }> {
    const filtered = items.filter((x) => x.model && x.price && !CarsPage.LABEL_EXCLUDE.test(x.model));
    if (brandName.trim()) return filtered.slice(0, 4);
    return filtered;
  }
}

