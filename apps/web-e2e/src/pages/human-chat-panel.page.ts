import { type BrowserContext, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Feature-flag cookie: mirrors `@hypha-platform/cookie` HYPHA_ENABLE_HUMAN_CHAT (e2e cannot
 * import the package directly here).
 */
const HYPHA_ENABLE_HUMAN_CHAT = 'HYPHA_ENABLE_HUMAN_CHAT';

export class HumanChatPanelPage extends BasePage {
  readonly openButton: Locator;
  readonly headerText: Locator;
  readonly headerIcon: Locator;
  readonly closeButton: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly sidebar: Locator;
  readonly sidebarWrapper: Locator;
  readonly resizeHandle: Locator;
  readonly membersTab: Locator;
  readonly chatTab: Locator;
  readonly membersContainer: Locator;
  readonly memberItems: Locator;

  static async enableHumanChat(context: BrowserContext, baseURL?: string) {
    await context.addCookies([
      {
        name: HYPHA_ENABLE_HUMAN_CHAT,
        value: 'true',
        domain: new URL(baseURL ?? 'http://127.0.0.1:3000').hostname,
        path: '/',
      },
    ]);
  }

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
    // The chat icon container (rounded bg-primary div with MessageCircle SVG)
    this.headerIcon = page
      .locator(
        '[data-side="right"] [data-sidebar="header"] .rounded-xl.bg-primary',
      )
      .first();
    // The header close button has aria-label="Close panel" within the right sidebar.
    // We scope to the right-side sidebar group to avoid collision with AI panel's close button.
    this.closeButton = page
      .locator('[data-side="right"] [data-sidebar="sidebar"]')
      .getByRole('button', { name: 'Close panel' });
    this.chatInput = page.getByPlaceholder('Type a message...');
    this.sendButton = page.getByRole('button', { name: 'Send' });
    this.sidebar = page.locator('[data-side="right"] [data-sidebar="sidebar"]');
    // The wrapper is the SidebarProvider div that contains the right-side sidebar
    this.sidebarWrapper = page.locator(
      '[data-sidebar="wrapper"]:has([data-side="right"])',
    );
    // Scope resize handle to the right sidebar to avoid collision with AI panel's handle
    this.resizeHandle = page.locator(
      '[data-side="right"] [data-sidebar="resize-handle"]',
    );
    this.membersTab = page
      .locator('[data-side="right"]')
      .getByRole('button', { name: /members/i });
    this.chatTab = page
      .locator('[data-side="right"]')
      .getByRole('button', { name: /^chat$/i });
    this.membersContainer = page.getByTestId('chat-panel-members');
    this.memberItems = page.getByTestId('chat-panel-member-item');
  }

  /** Navigate to a space's agreements page. Defaults to 'hypha'. */
  async navigateToSpace(spaceSlug = 'hypha') {
    await this.gotoApp(`/en/dho/${spaceSlug}/agreements`);
    await this.waitForPageLoad();
  }

  /** Alias for navigateToSpace with default slug. */
  async open(spaceSlug = 'hypha') {
    return this.navigateToSpace(spaceSlug);
  }

  /** Get all visible message texts from the panel. */
  async getMessageTexts(): Promise<string[]> {
    const rightPanel = this.page.locator(
      '[data-side="right"] [data-sidebar="sidebar"]',
    );
    const bodies = rightPanel.getByTestId('chat-message-body');
    return bodies.allTextContents();
  }

  /** Get the welcome message text if present. */
  get welcomeMessage(): Locator {
    const rightPanel = this.page.locator(
      '[data-side="right"] [data-sidebar="sidebar"]',
    );
    return rightPanel.getByText('Welcome to the chat', { exact: false });
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
