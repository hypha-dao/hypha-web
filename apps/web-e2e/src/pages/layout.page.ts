import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class LayoutPage extends BasePage {
  // Triggers
  readonly aiTrigger: Locator;
  readonly chatTrigger: Locator;
  // MenuTop
  readonly menuTop: Locator;
  // Left (AI) sidebar
  readonly leftSidebar: Locator;
  readonly leftSidebarHeader: Locator;
  readonly leftSidebarContent: Locator;
  readonly leftSidebarFooter: Locator;
  // Right (Human Chat) sidebar
  readonly rightSidebar: Locator;
  readonly rightSidebarHeader: Locator;
  readonly rightSidebarContent: Locator;
  readonly rightSidebarFooter: Locator;
  // Center content
  readonly centerInset: Locator;

  constructor(page: Page) {
    super(page);
    this.aiTrigger = page.getByRole('button', { name: /open hypha ai/i });
    this.chatTrigger = page.getByRole('button', { name: /open chat panel/i });
    this.menuTop = page.locator('header').filter({ has: page.locator('a') });
    this.leftSidebar = page.locator('[data-side="left"] [data-sidebar-fixed]');
    this.leftSidebarHeader = page.locator(
      '[data-side="left"] [data-sidebar="header"]',
    );
    this.leftSidebarContent = page.locator(
      '[data-side="left"] [data-sidebar="content"]',
    );
    this.leftSidebarFooter = page.locator(
      '[data-side="left"] [data-sidebar="footer"]',
    );
    this.rightSidebar = page.locator(
      '[data-side="right"] [data-sidebar-fixed]',
    );
    this.rightSidebarHeader = page.locator(
      '[data-side="right"] [data-sidebar="header"]',
    );
    this.rightSidebarContent = page.locator(
      '[data-side="right"] [data-sidebar="content"]',
    );
    this.rightSidebarFooter = page.locator(
      '[data-side="right"] [data-sidebar="footer"]',
    );
    // The innermost SidebarInset <main> holds the actual content.
    // With nested SidebarProviders, the last <main> is the innermost.
    this.centerInset = page.locator('main').last();
  }

  async open(path = '/en/dho/hypha/agreements') {
    await this.gotoApp(path);
    await this.waitForPageLoad();
  }

  async openAiPanel() {
    await this.aiTrigger.waitFor({ state: 'visible', timeout: 10000 });
    await this.aiTrigger.click();
  }

  async openChatPanel() {
    await this.chatTrigger.waitFor({ state: 'visible', timeout: 10000 });
    await this.chatTrigger.click();
  }

  async openBothPanels() {
    await this.openAiPanel();
    await this.openChatPanel();
  }
}
