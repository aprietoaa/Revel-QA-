import { expect, Page } from '@playwright/test';
import { logger } from '../utils/logger';

/** Page Object del filtro de Marca: abrir, ver todas las marcas, panel, seleccionar marca. */
export class BrandFilterPage {
  constructor(private readonly page: Page) {}

  private async waitForBrandPanelOpened(timeout: number): Promise<void> {
    const verTodas = this.page.getByText(/ver todas las marcas/i).first();
    const verMenos = this.page.getByText(/ver menos/i).first();
    const seleccionarTodas = this.page.getByText(/seleccionar todas las marcas/i).first();
    const panel = this.getBrandDropdownPanel().first();
    await Promise.race([
      panel.waitFor({ state: 'visible', timeout }).catch(() => Promise.reject(new Error('panel not visible'))),
      verTodas.waitFor({ state: 'visible', timeout }).catch(() => Promise.reject(new Error('verTodas not visible'))),
      verMenos.waitFor({ state: 'visible', timeout }).catch(() => Promise.reject(new Error('verMenos not visible'))),
      seleccionarTodas.waitFor({ state: 'visible', timeout }).catch(() => Promise.reject(new Error('seleccionarTodas not visible'))),
    ]).catch(() => {});
  }

  private async waitForBrandsExpanded(timeout: number): Promise<void> {
    const verMenos = this.page.getByText(/ver menos/i).first();
    await verMenos.waitFor({ state: 'visible', timeout }).catch(() => {});
  }

  async openBrandFilter(options?: {
    timeout?: number;
    locatorOverride?: string;
    testId?: string;
    openedIndicator?: RegExp;
    skipAssertOpened?: boolean;
  }) {
    const timeout = options?.timeout ?? 30_000;
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());
    const openedIndicator = options?.openedIndicator ?? /seleccionar todas las marcas/i;

    const assertOpened = async () => {
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

    const candidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId
        ? [{ name: `testid=${options.testId}`, locator: this.page.getByTestId(options.testId) }]
        : []),
      {
        name: 'div[class*="FilterShortcutButton"] con "Marca"',
        locator: this.page.locator('div[class*="FilterShortcutButton"]').filter({ has: this.page.locator('p', { hasText: /marca/i }) }).locator('p'),
      },
      { name: 'p[class*="Text_label"]:has-text("Marca")', locator: this.page.locator('p[class*="Text_label"]').filter({ hasText: /marca/i }) },
      { name: 'role=button[name~="Marca"]', locator: this.page.getByRole('button', { name: /marca/i }) },
      { name: 'role=combobox[name~="Marca"]', locator: this.page.getByRole('combobox', { name: /marca/i }) },
      { name: 'label="Marca"', locator: this.page.getByLabel(/marca/i) },
      { name: 'text="Marca"', locator: this.page.getByText(/^marca$/i) },
      { name: '[aria-label*="Marca"]', locator: this.page.locator('[aria-label*="Marca" i]') },
    ];

    const fastTimeout = 8_000;
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
                return { tag: el.tagName, id: el.id || null, className: el.className ? String(el.className).slice(0, 120) : null, text: text || null };
              }, { x, y })
              .catch(() => null);
            if (top) logger.muted(`Marca: elemento encima: <${top.tag.toLowerCase()}> id=${top.id ?? '-'} class=${top.className ?? '-'} text=${top.text ?? '-'}`);
          }
        }

        const clickableAncestor = target.locator('xpath=ancestor-or-self::*[self::button or self::a or @role="button" or @role="combobox"][1]');
        if ((await clickableAncestor.count().catch(() => 0)) > 0) {
          await clickableAncestor.first().click({ timeout: fastTimeout });
        } else {
          try {
            await target.click({ timeout: fastTimeout });
          } catch (error) {
            if (debug) logger.warn(`Click normal falló (${c.name}). Reintentando con force...`);
            await target.click({ timeout: fastTimeout, force: true });
          }
          const handle = await target.elementHandle();
          if (handle) {
            const clicked = await this.page.evaluate((el) => {
              const isClickable = (node: Element) => {
                const tag = node.tagName.toLowerCase();
                const role = (node.getAttribute('role') || '').toLowerCase();
                const cursor = window.getComputedStyle(node).cursor;
                return tag === 'button' || tag === 'a' || role === 'button' || role === 'combobox' || cursor === 'pointer' || node.hasAttribute('onclick');
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
            if (clicked && debug) logger.success('Filtro Marca clicado via ancestro');
          }
        }

        if (!options?.skipAssertOpened) await assertOpened();
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo abrir Marca con ${c.name}, probando otra opción...`);
      }
    }

    await this.page.screenshot({ path: 'tests/artifacts/open-brand-fail.png', fullPage: true }).catch(() => {});
    throw new Error(`No se pudo abrir el filtro "Marca". Último error: ${String(lastError)}`);
  }

  /**
   * Reabre el desplegable de marcas (p. ej. después de "Ver todas las marcas").
   * Encapsula la lógica de clic en el botón/filtro "Marca" para no duplicar selectores en los specs.
   */
  async reopenBrandFilter(options?: { timeout?: number; locatorOverride?: string }): Promise<void> {
    const timeout = options?.timeout ?? 10_000;
    const clickOpt = { timeout: 5_000, noWaitAfter: true } as const;

    if (options?.locatorOverride) {
      const marca = this.page.locator(options.locatorOverride).first();
      await marca.waitFor({ state: 'visible', timeout });
      await marca.click({ ...clickOpt, timeout });
      await this.waitForBrandPanelOpened(4_000);
      return;
    }

    const filterBar = this.page.locator('div[class*="ShortcutsFilterBar"]');
    const marcaByIndex = filterBar.locator('div:nth-child(7) div[class*="FilterShortcutButton"] > p').first();
    const marcaByText = this.page
      .locator('div[class*="FilterShortcutButton"]')
      .filter({ has: this.page.locator('p', { hasText: /marca/i }) })
      .locator('p')
      .first();
    try {
      await marcaByIndex.waitFor({ state: 'visible', timeout: 5_000 });
      await marcaByIndex.click(clickOpt);
    } catch {
      await marcaByText.waitFor({ state: 'visible', timeout: 5_000 });
      await marcaByText.click(clickOpt);
    }
    await this.waitForBrandPanelOpened(4_000);
  }

  async clickViewAllBrands(options?: { timeout?: number; locatorOverride?: string; testId?: string }) {
    const timeout = options?.timeout ?? 15_000;
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());
    const fastTimeout = 6_000;

    if (options?.locatorOverride) {
      logger.muted("Buscando 'Ver todas las marcas' (locatorOverride)...");
      const target = this.page.locator(options.locatorOverride).first();
      if (debug) logger.info(`Ver todas las marcas con locatorOverride: ${options.locatorOverride}`);
      await expect(target).toBeVisible({ timeout });
      await target.scrollIntoViewIfNeeded();
      await target.click({ timeout, noWaitAfter: true });
      await this.waitForBrandsExpanded(4_000);
      return;
    }

    logger.muted("Buscando 'Ver todas las marcas'...");
    let lastError: unknown = null;

    // Estrategia 1: dentro del panel del modal (timeouts cortos para no bloquear; si falla se prueban las demás)
    try {
      logger.muted("  Probando: dentro del panel Marca (scroll al final)...");
      const panel = this.getBrandDropdownPanel().first();
      await panel.waitFor({ state: 'visible', timeout: 2_500 });
      await panel.evaluate((el: HTMLElement) => {
        el.scrollTop = el.scrollHeight;
      }).catch(() => {});
      await this.page.waitForTimeout(150).catch(() => {});
      const linkInPanel = panel.getByText(/ver todas las marcas/i).first();
      await linkInPanel.waitFor({ state: 'attached', timeout: 2_000 });
      await linkInPanel.scrollIntoViewIfNeeded().catch(() => {});
      await this.page.waitForTimeout(80).catch(() => {});
      await linkInPanel.click({ timeout: 3_000, force: true, noWaitAfter: true });
      await this.waitForBrandsExpanded(4_000);
      return;
    } catch (e) {
      lastError = e;
      if (debug) logger.muted("  No se pudo con panel (scroll + link).");
    }

    const candidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId ? [{ name: `testid=${options.testId}`, locator: this.page.getByTestId(options.testId) }] : []),
      { name: 'p.Text_link + Text_underline', locator: this.page.locator('p[class*="Text_link__"][class*="Text_underline__"]').filter({ hasText: /ver todas las marcas/i }) },
      { name: 'p[class*="Text_link"]', locator: this.page.locator('p[class*="Text_link"]').filter({ hasText: /ver todas las marcas/i }) },
      { name: 'role=link', locator: this.page.getByRole('link', { name: /ver todas las marcas/i }) },
      { name: 'text="Ver todas las marcas"', locator: this.page.getByText(/ver todas las marcas/i).first() },
    ];

    const clickOpt = { timeout: fastTimeout, noWaitAfter: true } as const;
    for (const c of candidates) {
      try {
        logger.muted(`  Probando: ${c.name}...`);
        const target = c.locator.first();
        await expect(target).toBeVisible({ timeout: fastTimeout });
        await target.scrollIntoViewIfNeeded();
        const clickableAncestor = target.locator('xpath=ancestor-or-self::*[self::button or self::a or @role="button" or @role="link"][1]');
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
                return tag === 'button' || tag === 'a' || cursor === 'pointer';
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
        await this.waitForBrandsExpanded(4_000);
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo clicar "Ver todas las marcas" con ${c.name}.`);
      }
    }

    await this.page.screenshot({ path: 'tests/artifacts/view-all-brands-fail.png', fullPage: true }).catch(() => {});
    throw new Error(`No se pudo clicar "Ver todas las marcas". Último error: ${String(lastError)}`);
  }

  /** Panel del desplegable de marcas. Prioriza contenedores que tienen opciones (listbox/option) para no incluir el grid de coches. */
  getBrandDropdownPanel(): ReturnType<Page['locator']> {
    const byTestId = process.env.BRAND_DROPDOWN_TESTID;
    if (byTestId) return this.page.getByTestId(byTestId);
    const textPanel = /Ver menos|Ver todas las marcas|seleccionar todas las marcas/i;
    const rolePanel = this.page.getByRole('listbox').or(this.page.getByRole('dialog')).or(this.page.getByRole('menu')).filter({ hasText: textPanel }).first();
    const overlayConOpciones = this.page.locator('body > div').filter({
      has: this.page.getByRole('option').or(this.page.getByRole('menuitem')).or(this.page.getByText(textPanel)),
    }).filter({ hasText: textPanel }).first();
    const byContent = this.page.locator('div').filter({ has: this.page.getByText(textPanel) }).first();
    const fallback = this.page.locator('body > div').filter({ hasText: textPanel }).first();
    return rolePanel.or(overlayConOpciones).or(byContent).or(fallback);
  }

  /**
   * Obtiene la lista de marcas de coche disponibles en el panel (precondición: panel abierto y "Ver todas las marcas" pulsado).
   * Excluye todo lo que no es marca: etiquetas de filtros, colores, combustibles, tipos de carrocería, CTAs, etc.
   */
  async getAvailableBrands(options?: {
    timeout?: number;
    excludeTexts?: RegExp[] | string[];
  }): Promise<string[]> {
    const timeout = options?.timeout ?? 10_000;
    const defaultExclude: RegExp[] = [
      /seleccionar todas las marcas|ver todas las marcas|ver menos/i,
      /^\s*$/,
      /\d+\s*meses|\d+\s*l\b|contrata|online|minutos|pocos|€|euros?|precio|alquiler/i,
      /^marca$|^cambio$|^color$|^combustible$|^maletero$|^ordenar por$|^permanencia$|^promociones$|^tipo de coche$|^cuota$/i,
      /^manual$|^automático$/i,
      /^blanco$|^negro$|^rojo$|^verde$|^gris|^plata$/i,
      /^diesel$|^gasolina$|^eléctrico$|^híbrido/i,
      /^compacto$|^coupe$|^familiar$|^suv$/i,
      /^pick-up$|^pick up$|^berlina$|^monovolumen$/i,
      /^grande\s|^mediano\s|^pequeño|^muy grande/i,
      /crear una alerta|entrega\s*rápida|entrega:\s*más rápida/i,
    ];
    const excludePatterns = options?.excludeTexts ?? defaultExclude;
    const panel = this.getBrandDropdownPanel();
    await panel.first().waitFor({ state: 'visible', timeout }).catch(() => {});

    const optionSelectors = [
      panel.locator('p[class*="Text_regular__"]'),
      panel.getByRole('option'),
      panel.getByRole('menuitem'),
    ];
    const seen = new Set<string>();
    for (const loc of optionSelectors) {
      const count = await loc.count().catch(() => 0);
      if (count === 0) continue;
      const texts = await loc.allTextContents();
      for (const raw of texts) {
        const t = raw.trim();
        if (t.length < 2 || t.length > 25) continue;
        const excluded = excludePatterns.some((p) =>
          typeof p === 'string' ? t.toLowerCase().includes(p.toLowerCase()) : p.test(t)
        );
        if (!excluded) seen.add(t);
      }
      if (seen.size > 0) break;
    }
    return Array.from(seen).sort();
  }

  async selectBrand(brandName: string, options?: { timeout?: number; locatorOverride?: string; testId?: string }) {
    const timeout = options?.timeout ?? 15_000;
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());
    const re = new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const fastTimeout = 3_000;

    if (options?.locatorOverride) {
      const target = this.page.locator(options.locatorOverride).first();
      if (debug) logger.info(`Seleccionar marca ${brandName} con locatorOverride`);
      await expect(target).toBeVisible({ timeout: Math.min(timeout, 5_000) });
      await target.scrollIntoViewIfNeeded();
      await target.click({ timeout: fastTimeout, noWaitAfter: true });
      return;
    }

    const panel = this.getBrandDropdownPanel();
    await panel.first().waitFor({ state: 'visible', timeout: Math.min(timeout, 6_000) }).catch(() => {});
    // Hacer scroll en el panel para que opciones más abajo (p. ej. Renault) sean visibles y clickables
    await panel.first().evaluate((el: HTMLElement) => { el.scrollTop = 0; }).catch(() => {});
    await this.page.waitForTimeout(100).catch(() => {});
    const clickOpt = { timeout: fastTimeout, noWaitAfter: true } as const;

    const escaped = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRe = new RegExp(`^${escaped}$`, 'i');
    const scopedCandidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId ? [{ name: `testid=${options.testId} (en panel)`, locator: panel.getByTestId(options.testId) }] : []),
      { name: `text exacto "${brandName}" (en panel)`, locator: panel.getByText(brandName, { exact: true }).first() },
      { name: 'p exacto por regex', locator: panel.locator('p[class*="Text_regular__"]').filter({ hasText: exactRe }).first() },
      { name: `celda con "${brandName}"`, locator: panel.getByText(brandName, { exact: true }).locator('xpath=..').first() },
      { name: `role=menuitem`, locator: panel.getByRole('menuitem', { name: re }) },
      { name: `role=option`, locator: panel.getByRole('option', { name: re }) },
      { name: `role=button`, locator: panel.getByRole('button', { name: re }) },
      { name: `text="${brandName}" (en panel)`, locator: panel.getByText(re).first() },
      { name: 'p[class*="Text_regular__"]', locator: panel.locator('p[class*="Text_regular__"]').filter({ hasText: re }).first() },
    ];

    let lastError: unknown = null;
    for (const c of scopedCandidates) {
      try {
        const target = c.locator.first();
        if (debug) {
          const count = await c.locator.count().catch(() => 0);
          logger.info(`Seleccionar ${brandName}: ${c.name} (matches: ${count})`);
        }
        await expect(target).toBeVisible({ timeout: fastTimeout });
        await target.scrollIntoViewIfNeeded();
        await target.evaluate((el: HTMLElement) => el.scrollIntoView({ block: 'nearest', inline: 'nearest' })).catch(() => {});
        await target.click(clickOpt);
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo clicar ${brandName} con ${c.name}.`);
      }
    }

    throw new Error(
      `No se pudo seleccionar la marca "${brandName}" dentro del panel de marcas. ` +
        `(No se usa fallback a nivel página para no abrir una ficha de coche por error.) Último error: ${String(lastError)}`
    );
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

    const candidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId ? [{ name: `testid=${options.testId}`, locator: this.page.getByTestId(options.testId) }] : []),
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
        const clickableAncestor = target.locator('xpath=ancestor-or-self::*[self::button or self::a or @role="button" or @role="menuitem" or @role="link"][1]');
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
                return tag === 'button' || tag === 'a' || role === 'button' || role === 'menuitem' || role === 'link' || cursor === 'pointer' || node.hasAttribute('onclick');
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
}
