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
    this.openButton = page.getByRole('button', {
      name: 'Open Hypha AI panel',
    });
    this.headerText = page.getByText('Hypha AI', { exact: true });
    this.closeButton = page.getByRole('button', { name: 'Close panel' });
    this.resetButton = page.getByRole('button', { name: 'Reset chat' });
    this.signInPrompt = page.getByText('Sign in to use Hypha AI');
    this.signInButton = page.getByRole('button', {
      name: 'Sign In',
      exact: true,
    });
    this.chatInput = page.getByPlaceholder('Ask Hypha AI anything...');
    this.sendButton = page.getByRole('button', { name: 'Send' });
    this.resizeHandle = page.getByRole('separator', {
      name: 'Resize sidebar',
    });
    this.sidebar = page.locator('[data-sidebar="sidebar"]');
    this.sidebarWrapper = page.locator('.group\\/sidebar-wrapper');
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
    return parseInt(value, 10);
  }
}
