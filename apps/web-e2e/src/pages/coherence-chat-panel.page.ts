import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object Model for the Coherence Chat Panel integration.
 *
 * URL: /en/dho/:spaceSlug/coherence
 *
 * This page object covers the integration between:
 * - The Coherence signal cards (click targets)
 * - The Human Right Panel in coherence mode (panel state after click)
 *
 * Architecture (from docs/plans/coherence-chat-panel-plan.md):
 * - Clicking a signal card calls openCoherenceChat() + sidebar.setOpen(true)
 * - Panel header shows conversation title + ArrowLeft back button (coherence mode)
 * - Clicking back / closing panel resets to 'space' mode
 * - Panel header shows default "Chat" title in space mode
 *
 * Signal cards in authenticated state are wrapped in <button> elements by
 * SignalGrid when onSignalClick callback is provided — no <Link> navigation.
 */
export class CoherenceChatPanelPage extends BasePage {
  readonly spaceSlug: string;

  // ── Panel (right sidebar) ──────────────────────────────────────────────────

  /**
   * The right sidebar panel element.
   * Rendered by SidebarProvider with data-side="right".
   */
  readonly panelSidebar: Locator;

  /**
   * The panel header title span.
   * In space mode: "Chat" (i18n HumanChatPanel.title).
   * In coherence mode: conversation title from signal.
   */
  readonly panelHeaderTitle: Locator;

  /**
   * Back button in panel header (coherence mode only).
   * Rendered as a <button> with aria-label from i18n key "backToSpaceChat".
   * Expected aria-label: "Back to space chat"
   * Clicking calls closeCoherenceChat() → resets to space mode.
   */
  readonly backButton: Locator;

  /**
   * Panel close (hide) button — PanelRightClose icon.
   * aria-label="Close panel", title="Hide chat panel"
   */
  readonly closeButton: Locator;

  /**
   * Panel open trigger button in the page.
   * aria-label matching /open chat panel/i
   */
  readonly openPanelButton: Locator;

  /**
   * Panel messages/content area (SidebarContent).
   * Visible in both space mode and coherence mode.
   */
  readonly panelMessagesArea: Locator;

  /** Chat text input — placeholder "Type a message..." */
  readonly chatInput: Locator;

  /** Chat send button — role=button name="Send" */
  readonly sendButton: Locator;

  // ── Signal Cards ───────────────────────────────────────────────────────────

  /**
   * Signal card button wrappers rendered by SignalGrid.
   * In coherence mode, SignalGrid wraps each non-archived signal in a <button>
   * (instead of <Link>) to call openCoherenceChat on click.
   *
   * Located by data-testid="signal-card-button" added by the implementation.
   */
  readonly signalCardButtons: Locator;

  /** First signal card button in the grid */
  readonly firstSignalCard: Locator;

  /** Second signal card button in the grid */
  readonly secondSignalCard: Locator;

  /**
   * "Open conversation" button inside the first signal card.
   * Wired via onOpenConversation prop in Step 4 of the plan.
   */
  readonly firstOpenConversationButton: Locator;

  constructor(page: Page, spaceSlug = 'hypha') {
    super(page);
    this.spaceSlug = spaceSlug;

    // Panel locators — scoped to right sidebar
    this.panelSidebar = page.locator('[data-side="right"]');

    // Title span in the right sidebar header
    // In space mode: hasText "Chat", in coherence mode: conversation title
    this.panelHeaderTitle = page
      .locator('[data-side="right"] [data-sidebar="header"] span')
      .first();

    // Back button — aria-label added in Step 3 of the implementation plan.
    // i18n key: HumanChatPanel.backToSpaceChat → "Back to space chat"
    this.backButton = page
      .locator('[data-side="right"]')
      .getByRole('button', { name: /back to space chat/i });

    // Close button (PanelRightClose) — scoped to right sidebar to avoid AI panel collision
    this.closeButton = page
      .locator('[data-side="right"] [data-sidebar="sidebar"]')
      .getByRole('button', { name: 'Close panel' });

    // Open trigger (HumanSidebarTrigger)
    this.openPanelButton = page.getByRole('button', {
      name: /open chat panel/i,
    });

    // Messages area (SidebarContent rendered by HumanRightPanel)
    this.panelMessagesArea = page.locator(
      '[data-side="right"] [data-sidebar="content"]',
    );

    // Chat input and send button (same as HumanChatPanelPage)
    this.chatInput = page.getByPlaceholder('Type a message...');
    this.sendButton = page.getByRole('button', { name: 'Send' });

    // Signal card buttons — SignalGrid wraps non-archived signals in <button>
    // when onSignalClick callback is provided (Step 5 of implementation plan).
    // The implementation should add data-testid="signal-card-button" to each button.
    this.signalCardButtons = page.locator('[data-testid="signal-card-button"]');
    this.firstSignalCard = this.signalCardButtons.first();
    this.secondSignalCard = this.signalCardButtons.nth(1);

    // "Open conversation" button within the first signal card (Step 4)
    this.firstOpenConversationButton = this.signalCardButtons
      .first()
      .getByRole('button', {
        name: /open conversation|abrir conversa|ouvrir la conversation|gespräch öffnen|abrir conversación/i,
      });
  }

  /**
   * Navigate directly to the coherence page.
   */
  async openCoherencePage() {
    await this.gotoApp(`/en/dho/${this.spaceSlug}/coherence`);
    await this.waitForPageLoad();
  }

  /**
   * Get the visible text content of the first signal card's title.
   * The CardTitle renders inside the SignalCard component.
   */
  async getFirstSignalTitle(): Promise<string> {
    const titleEl = this.firstSignalCard.getByRole('heading').first();
    return ((await titleEl.textContent()) ?? '').trim();
  }

  /**
   * Get the visible text content of the second signal card's title.
   */
  async getSecondSignalTitle(): Promise<string> {
    const titleEl = this.secondSignalCard.getByRole('heading').first();
    return ((await titleEl.textContent()) ?? '').trim();
  }

  /**
   * Wait for the panel to enter coherence mode:
   * back button visible + title is NOT "Chat".
   */
  async waitForCoherenceMode() {
    await this.backButton.waitFor({ state: 'visible' });
  }

  /**
   * Wait for the panel to return to space chat mode:
   * back button hidden + title is "Chat".
   */
  async waitForSpaceMode() {
    await this.backButton.waitFor({ state: 'hidden' });
  }
}
