import { Page, Locator, BrowserContext } from '@playwright/test';
import { BasePage } from './base.page';

/** Cookie name used by the Vercel Flags SDK to toggle AI chat */
const AI_CHAT_COOKIE = 'HYPHA_ENABLE_AI_CHAT';

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
    this.openButton = page.locator('[aria-label="Open Hypha AI"]');
    this.headerText = page.getByText('Hypha AI', { exact: true });
    this.closeButton = page.getByRole('button', { name: /close/i });
    this.resetButton = page.getByRole('button', { name: /reset chat/i });
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

  /**
   * Enable the AI chat feature flag.
   *
   * The flag is a server-side Vercel flag evaluated during SSR,
   * so we need both:
   * - extraHTTPHeaders with Cookie for the initial SSR request
   * - browser cookies for any subsequent client-side navigations
   *
   * Call this BEFORE open() in test setup, or use the static helper.
   */
  static async enableAiChat(context: BrowserContext) {
    // Browser cookie for client-side reads
    await context.addCookies([
      {
        name: AI_CHAT_COOKIE,
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
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
