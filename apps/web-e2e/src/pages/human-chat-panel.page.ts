import { Page, Locator, BrowserContext } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Cookie name for the Human Chat feature flag.
 * Canonical source: packages/cookie/src/constants.ts → HYPHA_ENABLE_HUMAN_CHAT
 */
const HYPHA_ENABLE_HUMAN_CHAT = 'HYPHA_ENABLE_HUMAN_CHAT';

export class HumanChatPanelPage extends BasePage {
  readonly openButton: Locator;
  readonly headerText: Locator;
  readonly closeButton: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly sidebar: Locator;
  readonly sidebarWrapper: Locator;
  readonly resizeHandle: Locator;

  constructor(page: Page) {
    super(page);
    this.openButton = page.getByRole('button', {
      name: /open chat panel/i,
    });
    // Header title is a span (not a button) in the sidebar header
    this.headerText = page
      .locator('[data-side="right"] [data-sidebar="header"] span')
      .filter({ hasText: 'Chat' })
      .first();
    // The header close button has aria-label="Close panel" within the right sidebar.
    // We scope to the right-side sidebar group to avoid collision with AI panel's close button.
    this.closeButton = page
      .locator('[data-side="right"] [data-sidebar="sidebar"]')
      .getByRole('button', { name: 'Close panel' });
    this.chatInput = page.getByPlaceholder('Type a message...');
    this.sendButton = page.getByRole('button', { name: 'Send' });
    this.sidebar = page.locator('[data-sidebar="sidebar"]');
    this.sidebarWrapper = page.locator('[data-sidebar="wrapper"]');
    this.resizeHandle = page.getByRole('separator', {
      name: 'Resize sidebar',
    });
  }

  /**
   * Enable the Human Chat feature flag.
   *
   * The flag is evaluated during SSR via cookie, so we set
   * browser cookies for client-side navigations.
   *
   * Call this BEFORE open() in test setup, or use the static helper.
   */
  static async enableHumanChat(context: BrowserContext) {
    await context.addCookies([
      {
        name: HYPHA_ENABLE_HUMAN_CHAT,
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
  }

  async open(spaceSlug = 'hypha') {
    await this.page.goto(`/en/dho/${spaceSlug}/agreements`);
    await this.waitForPageLoad();
  }

  /** Navigate to a different space (without full page reload). */
  async navigateToSpace(spaceSlug: string) {
    await this.page.goto(`/en/dho/${spaceSlug}/agreements`);
    await this.waitForPageLoad();
  }

  /** Get all visible message texts from the panel. */
  async getMessageTexts(): Promise<string[]> {
    const sidebar = this.page.locator(
      '[data-side="right"] [data-sidebar="sidebar"]',
    );
    const bubbles = sidebar.locator('[class*="rounded-2xl"] span');
    return bubbles.allTextContents();
  }

  /** Get the welcome message text if present. */
  get welcomeMessage(): Locator {
    return this.page
      .locator('[data-side="right"] [data-sidebar="sidebar"]')
      .getByText('Welcome to the chat', { exact: false });
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
