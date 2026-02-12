import { expect, Page } from '@playwright/test';
import { logger } from '../utils/logger';

/** Page Object del filtro de Marca: abrir, ver todas las marcas, panel, seleccionar marca. */
export class BrandFilterPage {
  constructor(private readonly page: Page) {}

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

    const candidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId ? [{ name: `testid=${options.testId}`, locator: this.page.getByTestId(options.testId) }] : []),
      { name: 'p.Text_link + Text_underline', locator: this.page.locator('p[class*="Text_link__"][class*="Text_underline__"]').filter({ hasText: /ver todas las marcas/i }) },
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
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo clicar "Ver todas las marcas" con ${c.name}.`);
      }
    }

    await this.page.screenshot({ path: 'tests/artifacts/view-all-brands-fail.png', fullPage: true }).catch(() => {});
    throw new Error(`No se pudo clicar "Ver todas las marcas". Último error: ${String(lastError)}`);
  }

  getBrandDropdownPanel(): ReturnType<Page['locator']> {
    const byTestId = process.env.BRAND_DROPDOWN_TESTID;
    if (byTestId) return this.page.getByTestId(byTestId);
    const panelWithVerMenos = this.page.locator('body > div').filter({ hasText: /Ver menos/i }).first();
    const overlay = this.page.locator('body > div').nth(7).filter({ hasText: /seleccionar todas las marcas|Ver menos/i });
    const rolePanel = this.page.getByRole('listbox').or(this.page.getByRole('dialog')).or(this.page.getByRole('menu')).filter({ hasText: /seleccionar todas las marcas/i }).first();
    const byContent = this.page.locator('div').filter({ has: this.page.getByText(/seleccionar todas las marcas/i) }).first();
    return panelWithVerMenos.or(overlay).or(rolePanel).or(byContent);
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
    const clickOpt = { timeout: fastTimeout, noWaitAfter: true } as const;

    const scopedCandidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId ? [{ name: `testid=${options.testId} (en panel)`, locator: panel.getByTestId(options.testId) }] : []),
      { name: `celda con "${brandName}"`, locator: panel.getByText(brandName, { exact: true }).locator('xpath=..').first() },
      { name: `text exacto "${brandName}" (en panel)`, locator: panel.getByText(brandName, { exact: true }).first() },
      { name: `role=menuitem`, locator: panel.getByRole('menuitem', { name: re }) },
      { name: `role=option`, locator: panel.getByRole('option', { name: re }) },
      { name: `role=button`, locator: panel.getByRole('button', { name: re }) },
      { name: `text="${brandName}" (en panel)`, locator: panel.getByText(re).first() },
      { name: 'p[class*="Text_regular__"] exacto', locator: panel.locator('p[class*="Text_regular__"]').filter({ hasText: new RegExp(`^${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }) },
      { name: 'p[class*="Text_regular__"]', locator: panel.locator('p[class*="Text_regular__"]').filter({ hasText: re }) },
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
        await target.click(clickOpt);
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo clicar ${brandName} con ${c.name}.`);
      }
    }

    const pageCandidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      { name: `role=menuitem`, locator: this.page.getByRole('menuitem', { name: re }) },
      { name: `role=link`, locator: this.page.getByRole('link', { name: re }) },
      { name: `text="${brandName}"`, locator: this.page.getByText(re).first() },
      { name: 'p[class*="Text_regular__"]', locator: this.page.locator('p[class*="Text_regular__"]').filter({ hasText: re }) },
    ];
    for (const c of pageCandidates) {
      try {
        const target = c.locator.first();
        await expect(target).toBeVisible({ timeout: fastTimeout });
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
