import { Page } from '@playwright/test';
import { BrandFilterPage } from './brand-filter.page';
import { ExchangeTypeFilterPage } from './exchange-type-filter.page';
import { CarsGridPage } from './cars-grid.page';

/**
 * Fachada que agrupa filtro de marca, filtro de tipo de cambio y listado/grid de coches.
 * Los specs siguen usando CarsPage con la misma API; la lógica está en BrandFilterPage, ExchangeTypeFilterPage y CarsGridPage.
 */
export class CarsPage {
  readonly brandFilter: BrandFilterPage;
  readonly exchangeTypeFilter: ExchangeTypeFilterPage;
  readonly grid: CarsGridPage;

  constructor(page: Page) {
    this.brandFilter = new BrandFilterPage(page);
    this.exchangeTypeFilter = new ExchangeTypeFilterPage(page);
    this.grid = new CarsGridPage(page);
  }

  // --- Filtro Marca ---
  async openBrandFilter(
    options?: Parameters<BrandFilterPage['openBrandFilter']>[0]
  ): Promise<void> {
    return this.brandFilter.openBrandFilter(options);
  }

  async clickViewAllBrands(
    options?: Parameters<BrandFilterPage['clickViewAllBrands']>[0]
  ): Promise<void> {
    return this.brandFilter.clickViewAllBrands(options);
  }

  async reopenBrandFilter(
    options?: Parameters<BrandFilterPage['reopenBrandFilter']>[0]
  ): Promise<void> {
    return this.brandFilter.reopenBrandFilter(options);
  }

  getBrandDropdownPanel(): ReturnType<BrandFilterPage['getBrandDropdownPanel']> {
    return this.brandFilter.getBrandDropdownPanel();
  }

  async getAvailableBrands(
    options?: Parameters<BrandFilterPage['getAvailableBrands']>[0]
  ): Promise<string[]> {
    return this.brandFilter.getAvailableBrands(options);
  }

  async selectBrand(
    brandName: string,
    options?: Parameters<BrandFilterPage['selectBrand']>[1]
  ): Promise<void> {
    return this.brandFilter.selectBrand(brandName, options);
  }

  async selectAllBrands(
    options?: Parameters<BrandFilterPage['selectAllBrands']>[0]
  ): Promise<void> {
    return this.brandFilter.selectAllBrands(options);
  }

  // --- Filtro Tipo de cambio ---
  async clickExchangeTypeFilter(
    options?: Parameters<ExchangeTypeFilterPage['clickExchangeTypeFilter']>[0]
  ): Promise<void> {
    return this.exchangeTypeFilter.clickExchangeTypeFilter(options);
  }

  getExchangeTypeDropdownPanel(): ReturnType<ExchangeTypeFilterPage['getExchangeTypeDropdownPanel']> {
    return this.exchangeTypeFilter.getExchangeTypeDropdownPanel();
  }

  async getAvailableExchangeTypes(
    options?: Parameters<ExchangeTypeFilterPage['getAvailableExchangeTypes']>[0]
  ): Promise<string[]> {
    return this.exchangeTypeFilter.getAvailableExchangeTypes(options);
  }

  async selectExchangeTypeOption(
    optionName: string,
    options?: Parameters<ExchangeTypeFilterPage['selectExchangeTypeOption']>[1]
  ): Promise<void> {
    return this.exchangeTypeFilter.selectExchangeTypeOption(optionName, options);
  }

  // --- Listado / grid de coches ---
  async getVisibleModelNames(
    options?: Parameters<CarsGridPage['getVisibleModelNames']>[0]
  ): Promise<string[]> {
    return this.grid.getVisibleModelNames(options);
  }

  async waitForGridVisible(
    options?: Parameters<CarsGridPage['waitForResultsVisible']>[0]
  ): Promise<void> {
    return this.grid.waitForResultsVisible(options);
  }

  async scrollResultsIntoView(
    options?: Parameters<CarsGridPage['scrollResultsIntoView']>[0]
  ): Promise<void> {
    return this.grid.scrollResultsIntoView(options);
  }

  async scrollToLoadAllCards(
    options?: Parameters<CarsGridPage['scrollToLoadAllCards']>[0]
  ): Promise<void> {
    return this.grid.scrollToLoadAllCards(options);
  }

  async clearFilters(
    options?: Parameters<CarsGridPage['clearFilters']>[0]
  ): Promise<void> {
    return this.grid.clearFilters(options);
  }

  async getVisibleModelsWithPrices(
    options?: Parameters<CarsGridPage['getVisibleModelsWithPrices']>[0]
  ): Promise<Array<{ model: string; price: string }>> {
    return this.grid.getVisibleModelsWithPrices(options);
  }

  async assertResultsContainBrand(
    brandName: string,
    options?: Parameters<CarsGridPage['assertResultsContainBrand']>[1]
  ): Promise<void> {
    return this.grid.assertResultsContainBrand(brandName, options);
  }

  async clickFirstVisibleCar(
    options?: Parameters<CarsGridPage['clickFirstVisibleCar']>[0]
  ): Promise<void> {
    return this.grid.clickFirstVisibleCar(options);
  }
}
