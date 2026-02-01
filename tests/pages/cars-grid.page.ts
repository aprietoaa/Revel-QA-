import { expect, Page } from '@playwright/test';
import { logger } from '../utils/logger';
import {
  PRICE_PATTERN,
  LABEL_EXCLUDE,
  STRIP_FROM_MODEL,
  MODEL_CLEAN,
  getBrandPlusModel,
  limitToCarsOnly,
} from '../helpers/car-card-helpers';

/** Page Object del listado/grid de coches: scroll, listar modelos/precios, limpiar filtros, clic en primer coche. */
export class CarsGridPage {
  constructor(private readonly page: Page) {}

  async getVisibleModelNames(options?: {
    brandName?: string;
    timeout?: number;
    listTestId?: string;
    cardTestId?: string;
  }): Promise<string[]> {
    const items = await this.getVisibleModelsWithPrices(options);
    return items.map((x) => x.model);
  }

  async scrollResultsIntoView(options?: { behavior?: 'auto' | 'smooth' }): Promise<void> {
    const behavior = options?.behavior ?? 'auto';
    await this.page.evaluate((b: ScrollBehavior) => window.scrollBy({ top: 450, behavior: b }), behavior);
    await this.page.locator('article, [role="listitem"]').first().waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});
  }

  async scrollToLoadAllCards(options?: { rounds?: number; pauseMs?: number }): Promise<void> {
    const rounds = options?.rounds ?? 5;
    const pauseMs = options?.pauseMs ?? 1200;
    for (let r = 0; r < rounds; r += 1) {
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.page.waitForTimeout(pauseMs);
    }
    await this.page.evaluate(() => window.scrollTo(0, 0));
    await this.page.waitForTimeout(300);
  }

  async clearFilters(options?: { timeout?: number; locatorOverride?: string }): Promise<void> {
    const timeout = options?.timeout ?? 10_000;
    const override = options?.locatorOverride ?? process.env.CLEAR_FILTERS_LOCATOR;
    const waitForListAfterClear = async (): Promise<void> => {
      await this.page.waitForLoadState('networkidle').catch(() => {});
      const carCard = this.page.locator('article, [role="listitem"]').filter({ hasText: /\d[\d.,]*\s*€/ }).first();
      await carCard.waitFor({ state: 'visible', timeout: 18_000 }).catch(() => {});
    };

    if (override) {
      const loc = this.page.locator(override).first();
      await loc.waitFor({ state: 'visible', timeout });
      await loc.click({ timeout: 5_000 });
      await waitForListAfterClear();
      logger.success('Filtros limpiados (con locator override).');
      return;
    }
    const candidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      { name: 'texto "Limpiar filtros"', locator: this.page.getByText(/limpiar\s*filtros/i).first() },
      { name: 'texto "Borrar filtros"', locator: this.page.getByText(/borrar\s*filtros/i).first() },
      { name: 'texto "Quitar filtros"', locator: this.page.getByText(/quitar\s*filtros/i).first() },
      { name: 'texto "Restablecer"', locator: this.page.getByText(/restablecer/i).first() },
      { name: 'role=button Limpiar', locator: this.page.getByRole('button', { name: /limpiar|borrar|reset/i }) },
      { name: 'role=link Limpiar', locator: this.page.getByRole('link', { name: /limpiar\s*filtros|borrar\s*filtros|reset/i }) },
    ];
    for (const c of candidates) {
      try {
        const el = c.locator.first();
        await el.waitFor({ state: 'visible', timeout: 4_000 });
        await el.click({ timeout: 5_000 });
        await waitForListAfterClear();
        logger.success(`Filtros limpiados (${c.name}).`);
        return;
      } catch {
        // siguiente candidato
      }
    }
    throw new Error(
      'No se encontró botón/link para limpiar filtros. Si la web tiene uno, define CLEAR_FILTERS_LOCATOR en env.'
    );
  }

  async getVisibleModelsWithPrices(options?: {
    brandName?: string;
    timeout?: number;
    listTestId?: string;
    cardTestId?: string;
    maxItems?: number;
  }): Promise<Array<{ model: string; price: string }>> {
    const timeout = options?.timeout ?? 10_000;
    const brandName = options?.brandName ?? '';
    const maxItems = options?.maxItems;
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());

    await this.scrollResultsIntoView();
    if (maxItems != null && maxItems > 10) {
      logger.info('Cargando más cards (scroll, puede tardar unos segundos)...');
      await this.scrollToLoadAllCards({ rounds: 5, pauseMs: 1200 });
    }

    const listTestId = options?.listTestId ?? process.env.CAR_LIST_TESTID;
    const cardTestId = options?.cardTestId ?? process.env.CAR_CARD_TESTID;
    const carTitleSelector = 'p[class*="Text_displayS"], p[class*="Text_text-ellipsis"]';
    const logProgress = maxItems != null && maxItems > 10;

    const extractFromCards = async (cards: ReturnType<Page['locator']>): Promise<Array<{ model: string; price: string }>> => {
      const count = await cards.count();
      const out: Array<{ model: string; price: string }> = [];
      const brandNorm = brandName.trim();
      if (logProgress && count > 0) logger.info(`Listando coches (${count} cards encontradas)...`);
      for (let i = 0; i < count; i += 1) {
        if (logProgress && (i === 0 || (i + 1) % 5 === 0 || i === count - 1)) {
          logger.muted(`Procesando card ${i + 1}/${count}...`);
        }
        const card = cards.nth(i);
        await card.first().scrollIntoViewIfNeeded().catch(() => {});
        await card.first().waitFor({ state: 'visible', timeout: 1_000 }).catch(() => {});
        const text = await card.first().innerText().catch(() => '');
        const textClean = text.replace(MODEL_CLEAN, ' ').replace(/\s+/g, ' ').trim();
        const lines = text.trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
        let model = '';
        if (brandNorm) {
          const match = textClean.match(getBrandPlusModel(brandNorm));
          if (match) model = `${brandNorm} ${match[1].trim()}`;
        }
        if (!model) {
          for (const line of lines) {
            if (!line || LABEL_EXCLUDE.test(line)) continue;
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
        if (!model && !brandNorm) model = textClean.slice(0, 50).trim() || 'Coche';
        if (LABEL_EXCLUDE.test(model) || !model) continue;
        if (brandNorm && !model.toLowerCase().startsWith(brandNorm.toLowerCase())) {
          model = `${brandNorm} ${model}`;
        }
        model = model.replace(STRIP_FROM_MODEL, ' ').replace(MODEL_CLEAN, ' ').replace(/\s+/g, ' ').trim();
        const priceMatch = text.match(PRICE_PATTERN);
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
      const result = limitToCarsOnly(await extractFromCards(cards), brandName, maxItems);
      if (result.length > 0) {
        if (debug) logger.info(`getVisibleModelsWithPrices: ${result.length} cards (listTestId)`);
        return result;
      }
    }

    if (cardTestId) {
      const cards = this.page.getByTestId(cardTestId);
      await cards.first().waitFor({ state: 'visible', timeout }).catch(() => {});
      const result = limitToCarsOnly(await extractFromCards(cards), brandName, maxItems);
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
      { name: 'div con título + precio (grid)', locator: this.page.locator('div').filter({ hasText: PRICE_PATTERN }) },
    ];

    const candidateTimeout = Math.min(timeout, 3_000);
    for (const c of cardCandidates) {
      try {
        const loc = brandRe ? c.locator.filter({ hasText: brandRe }) : c.locator;
        await loc.first().waitFor({ state: 'visible', timeout: candidateTimeout });
        const result = limitToCarsOnly(await extractFromCards(loc), brandName, maxItems);
        if (result.length > 0) {
          if (debug) logger.info(`getVisibleModelsWithPrices: ${result.length} con ${c.name}`);
          return result;
        }
      } catch {
        // siguiente candidato
      }
    }

    const pricePatternStr = PRICE_PATTERN.source;
    const labelExcludeStr = LABEL_EXCLUDE.source;
    const stripFromModelStr = STRIP_FROM_MODEL.source;
    const modelCleanStr = MODEL_CLEAN.source;
    const brandPlusModelStr = getBrandPlusModel(brandName).source;
    const fallback = await this.page.evaluate(
      (opts: {
        brand: string;
        pricePattern: string;
        labelExclude: string;
        stripFromModel: string;
        modelClean: string;
        brandPlusModel: string;
        carTitleSelector: string;
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
          if (!opts.brand) {
            const titleEl = el.querySelector(opts.carTitleSelector);
            if (titleEl) {
              const t = (titleEl.textContent || '').trim().replace(/\s+/g, ' ').trim();
              if (t.length >= 2 && t.length <= 80 && !labelRe.test(t)) model = t;
            }
          }
          if (!model && opts.brand) {
            const brandModelMatch = text.match(brandModelRe);
            if (brandModelMatch) model = `${opts.brand} ${brandModelMatch[1].trim()}`;
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
          if (!model && !opts.brand) model = text.slice(0, 50).trim() || 'Coche';
          if (labelRe.test(model)) return;
          if (opts.brand && !model.toLowerCase().startsWith(opts.brand.toLowerCase())) {
            model = `${opts.brand} ${model}`;
          }
          model = model.replace(stripRe, ' ').replace(cleanRe, ' ').replace(/\s+/g, ' ').trim();
          if (!model) return;
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
        carTitleSelector,
      }
    );

    if (fallback.length > 0) {
      if (debug) logger.info(`getVisibleModelsWithPrices: ${fallback.length} (fallback evaluate)`);
      return limitToCarsOnly(fallback, brandName, maxItems);
    }

    logger.warn('No se encontraron modelos con precio visibles.');
    return [];
  }

  async clickFirstVisibleCar(options?: {
    timeout?: number;
    locatorOverride?: string;
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
        locatorOverride.startsWith('/') || locatorOverride.startsWith('(/') ? `xpath=${locatorOverride}` : locatorOverride;
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
}
