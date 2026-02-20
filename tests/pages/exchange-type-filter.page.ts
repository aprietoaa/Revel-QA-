import { expect, Page } from '@playwright/test';
import { logger } from '../utils/logger';

/** Page Object del filtro Tipo de cambio: abrir, overlay/panel, seleccionar opción (ej. Manual). */
export class ExchangeTypeFilterPage {
  constructor(private readonly page: Page) {}

  async clickExchangeTypeFilter(options?: { timeout?: number; locatorOverride?: string; testId?: string }) {
    const timeout = options?.timeout ?? 15_000;
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());
    const fastTimeout = 8_000;
    const clickOpt = { timeout: fastTimeout, noWaitAfter: true } as const;

    const locatorOverride = options?.locatorOverride ?? process.env.EXCHANGE_TYPE_LOCATOR;
    if (locatorOverride) {
      const selector =
        locatorOverride.startsWith('/') || locatorOverride.startsWith('(/') ? `xpath=${locatorOverride}` : locatorOverride;
      const target = this.page.locator(selector).first();
      if (debug) logger.info(`Tipo de cambio con locatorOverride: ${locatorOverride}`);
      await expect(target).toBeVisible({ timeout });
      await target.scrollIntoViewIfNeeded();
      await target.click(clickOpt);
      return;
    }

    const candidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      ...(options?.testId ? [{ name: `testid=${options.testId}`, locator: this.page.getByTestId(options.testId) }] : []),
      {
        name: 'FilterShortcutButton con "Cambio" (botón completo)',
        locator: this.page
          .locator('div[class*="FilterShortcutButton"]')
          .filter({ has: this.page.locator('p', { hasText: /^cambio$/i }) })
          .first(),
      },
      {
        name: 'FilterShortcutButton "Cambio" > p',
        locator: this.page
          .locator('div[class*="FilterShortcutButton"]')
          .filter({ has: this.page.locator('p', { hasText: /^cambio$/i }) })
          .locator('p')
          .first(),
      },
      { name: 'text exacto "Cambio"', locator: this.page.getByText(/^cambio$/i).first() },
      { name: 'role=button Cambio', locator: this.page.getByRole('button', { name: /^cambio$/i }) },
      {
        name: 'FilterShortcutButton con "tipo de cambio"',
        locator: this.page
          .locator('div[class*="FilterShortcutButton"]')
          .filter({ has: this.page.locator('p', { hasText: /tipo de cambio/i }) })
          .first(),
      },
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
        logger.success('Filtro Cambio pulsado.');
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.muted(`No se pudo clicar Cambio con ${c.name}.`);
      }
    }

    await this.page.screenshot({ path: 'tests/artifacts/exchange-type-fail.png', fullPage: true }).catch(() => {});
    throw new Error(`No se pudo pulsar en "Cambio" (filtro tipo de cambio). Último error: ${String(lastError)}`);
  }

  private getExchangeTypeOverlay(): ReturnType<Page['locator']> {
    return this.page.locator('body > div').nth(7);
  }

  getExchangeTypeDropdownPanel(): ReturnType<Page['locator']> {
    const byTestId = process.env.EXCHANGE_TYPE_PANEL_TESTID;
    if (byTestId) return this.page.getByTestId(byTestId);
    return this.getExchangeTypeOverlay();
  }

  /**
   * Busca el panel del filtro Cambio por contenido (Manual/Automático) por si nth(7) no coincide.
   */
  private getExchangeTypePanelByContent(): ReturnType<Page['locator']> {
    return this.page
      .locator('body > div')
      .filter({ has: this.page.locator('p, [role="option"]').filter({ hasText: /manual|automático/i }) })
      .first();
  }

  /**
   * Obtiene la lista de tipos de cambio disponibles en el desplegable (precondición: filtro Cambio abierto).
   * Excluye textos que no son opciones de cambio (CTAs, frases largas, etc.).
   * Si no se detecta ninguna, devuelve lista por defecto ['Manual', 'Automático'] para que el test pueda seguir.
   */
  async getAvailableExchangeTypes(options?: { timeout?: number }): Promise<string[]> {
    const timeout = options?.timeout ?? 6_000;
    const excludePatterns: RegExp[] = [
      /contrata|online|minutos|pocos/i,
      /entrega\s*gratuita|gratuita/i,
      /^\s*$/,
    ];

    const tryPanel = async (panel: ReturnType<Page['locator']>): Promise<string[]> => {
      await panel.first().waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {});
      const optionSelectors = [
        panel.locator('p').filter({ hasText: /\w{2,}/ }),
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
          if (t.length < 2 || t.length > 20) continue;
          const excluded = excludePatterns.some((p) => p.test(t));
          if (!excluded) seen.add(t);
        }
        if (seen.size > 0) return Array.from(seen).sort();
      }
      return [];
    };

    let list = await tryPanel(this.getExchangeTypeDropdownPanel());
    if (list.length === 0) list = await tryPanel(this.getExchangeTypePanelByContent());
    if (list.length === 0) {
      const fallback = this.page.getByRole('option').or(this.page.locator('p').filter({ hasText: /manual|automático/i }));
      const count = await fallback.count().catch(() => 0);
      if (count > 0) {
        const texts = await fallback.allTextContents();
        for (const raw of texts) {
          const t = raw.trim();
          if (t.length >= 2 && t.length <= 20 && !excludePatterns.some((p) => p.test(t))) list.push(t);
        }
        list = [...new Set(list)].sort();
      }
    }
    if (list.length === 0) return ['Manual', 'Automático'];
    const soloTransmision = list.filter((t) => /^manual$|^automático$/i.test(t.trim()));
    return soloTransmision.length > 0 ? soloTransmision : ['Manual', 'Automático'];
  }

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
        locatorOverride.startsWith('/') || locatorOverride.startsWith('(/') ? `xpath=${locatorOverride}` : locatorOverride;
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
}
