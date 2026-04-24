import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class AiChatPanelPage extends BasePage {
  readonly openButton: Locator;
  readonly headerText: Locator;
  readonly closeButton: Locator;
  readonly resetButton: Locator;
  readonly signInPrompt: Locator;
  readonly signInButton: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly resizeHandle: Locator;
  readonly sidebar: Locator;
  readonly sidebarWrapper: Locator;

  constructor(page: Page) {
    super(page);
    this.openButton = page.getByRole('button', { name: /open ai chat/i });
    this.headerText = page.getByText('AI Chat', { exact: true });
    this.closeButton = page
      .locator('[data-side="left"] [data-sidebar="sidebar"]')
      .getByRole('button', { name: 'Close panel' });
    this.resetButton = page.getByRole('button', { name: /reset chat/i });
    this.signInPrompt = page.getByText('Sign in to use AI Chat');
    this.signInButton = page.getByRole('button', {
      name: 'Sign In',
      exact: true,
    });
    this.chatInput = page.getByPlaceholder('Ask anything about this space...');
    this.sendButton = page.getByRole('button', { name: 'Send' });
    // Scope to the left sidebar to avoid collision with Human Chat panel
    this.resizeHandle = page.locator(
      '[data-side="left"] [data-sidebar="resize-handle"]',
    );
    this.sidebar = page.locator('[data-side="left"] [data-sidebar="sidebar"]');
    this.sidebarWrapper = page.locator(
      '[data-sidebar="wrapper"]:has([data-side="left"])',
    );
  }

  async open() {
    await this.page.goto('/en/dho/hypha');
    await this.waitForPageLoad();
  }

  async openPanel() {
    await this.openButton.click();
  }

  async closePanel() {
    await this.closeButton.click();
  }

  async getSidebarWidth(): Promise<number> {
    const value = await this.sidebarWrapper.evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--sidebar-width'),
    );
    const width = parseInt(value, 10);
    if (Number.isNaN(width)) {
      throw new Error(`Invalid sidebar width value: "${value}"`);
    }
    return width;
  }
}
