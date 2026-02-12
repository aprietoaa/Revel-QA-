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
        name: 'div[class*="FilterShortcutButton"] con "Cambio"',
        locator: this.page
          .locator('div[class*="FilterShortcutButton"]')
          .filter({ has: this.page.locator('p', { hasText: /^cambio$/i }) })
          .locator('p'),
      },
      { name: 'p[class*="Text_label"] Cambio', locator: this.page.locator('p[class*="Text_label"]').filter({ hasText: /^cambio$/i }) },
      {
        name: 'div[class*="FilterShortcutButton"] con "tipo de cambio"',
        locator: this.page
          .locator('div[class*="FilterShortcutButton"]')
          .filter({ has: this.page.locator('p', { hasText: /tipo de cambio/i }) })
          .locator('p'),
      },
      { name: 'p[class*="Text_label"] tipo de cambio', locator: this.page.locator('p[class*="Text_label"]').filter({ hasText: /tipo de cambio/i }) },
      { name: 'text="Cambio"', locator: this.page.getByText(/^cambio$/i).first() },
      { name: 'text="Tipo de cambio"', locator: this.page.getByText(/tipo de cambio/i).first() },
      { name: 'role=button Cambio', locator: this.page.getByRole('button', { name: /^cambio$/i }) },
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

  private getExchangeTypeOverlay(): ReturnType<Page['locator']> {
    return this.page.locator('body > div').nth(7);
  }

  getExchangeTypeDropdownPanel(): ReturnType<Page['locator']> {
    const byTestId = process.env.EXCHANGE_TYPE_PANEL_TESTID;
    if (byTestId) return this.page.getByTestId(byTestId);
    return this.getExchangeTypeOverlay();
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
