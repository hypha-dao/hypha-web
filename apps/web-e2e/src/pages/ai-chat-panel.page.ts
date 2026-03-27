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

  constructor(page: Page) {
    super(page);
    this.openButton = page.getByRole('button', {
      name: 'Open Hypha AI panel',
    });
    this.headerText = page.getByText('Hypha AI', { exact: true });
    this.closeButton = page.getByRole('button', { name: 'Close panel' });
    this.resetButton = page.getByRole('button', { name: 'Reset chat' });
    this.signInPrompt = page.getByText('Sign in to use Hypha AI');
    this.signInButton = page.getByRole('button', { name: 'Sign In', exact: true });
    this.chatInput = page.getByPlaceholder('Ask Hypha AI anything...');
    this.sendButton = page.getByRole('button', { name: 'Send' });
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
}
