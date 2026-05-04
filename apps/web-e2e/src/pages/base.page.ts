import { Page } from '@playwright/test';
import { resolveAppUrl } from '../utils/nav-url';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Same origin as Playwright `use.baseURL`; safe when config is not loaded. */
  async gotoApp(path: string) {
    await this.page.goto(resolveAppUrl(path));
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('domcontentloaded');
  }
}
