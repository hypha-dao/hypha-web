import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object Model for the Coherence screen.
 *
 * URL pattern: /en/dho/:spaceSlug/coherence
 *
 * This page object covers:
 * - Navigation tab in DHO layout
 * - Coherence page main content (signal section)
 * - Signal type filter badges
 * - Search input
 * - "New Signal" button
 * - Create signal form navigation
 * - Unauthenticated "sign in to see" message
 */
export class CoherencePage extends BasePage {
  readonly spaceSlug: string;

  // ── Navigation ─────────────────────────────────────────────────────────────
  /** The "Coherence" tab link in the DHO navigation bar */
  readonly coherenceTab: Locator;

  // ── Page content ───────────────────────────────────────────────────────────
  /** Main "Signals" section heading */
  readonly signalsSectionHeading: Locator;

  /** "New Signal" button in the signal section */
  readonly newSignalButton: Locator;

  /** Search signals input field */
  readonly searchInput: Locator;

  /** "Sign in to see signals and conversations" message (unauthenticated state) */
  readonly signInMessage: Locator;

  // ── Signal type filter badges ───────────────────────────────────────────────
  /** "All" filter badge */
  readonly allFilterBadge: Locator;

  /** Filter badge row container (used to assert multiple badges are rendered) */
  readonly filterBadgeContainer: Locator;

  // ── Create signal form ─────────────────────────────────────────────────────
  /** Page heading of the create signal form */
  readonly createSignalHeading: Locator;

  constructor(page: Page, spaceSlug = 'hypha') {
    super(page);
    this.spaceSlug = spaceSlug;

    // Navigation tab (rendered in DHO NavigationTabs component)
    this.coherenceTab = page.getByRole('link', { name: 'Coherence' });

    // Signal section
    this.signalsSectionHeading = page.getByRole('heading', { name: 'Signals' });

    // "New Signal" button (exact match to avoid false positives)
    this.newSignalButton = page.getByRole('link', { name: 'New Signal' });

    // Search input — placeholder defined in CoherenceTab.searchSignals i18n key
    this.searchInput = page.getByPlaceholder('Search signals...');

    // Unauthenticated sign-in prompt
    this.signInMessage = page.getByText(
      'Please, sign in to see signals and conversations',
      { exact: false },
    );

    // Filter badges — "All" is always the first badge
    this.allFilterBadge = page.getByRole('button', { name: 'All' });

    // Container that holds all type filter badges
    this.filterBadgeContainer = page.locator(
      '[data-testid="signal-type-filters"]',
    );

    // Create signal form heading
    this.createSignalHeading = page.getByRole('heading', {
      name: /creating new signal/i,
    });
  }

  /**
   * Navigate to the DHO agreements tab — a reliable starting point
   * from which we can click the Coherence navigation tab.
   */
  async openDhoPage() {
    await this.page.goto(`/en/dho/${this.spaceSlug}/agreements`);
    await this.waitForPageLoad();
  }

  /**
   * Navigate directly to the coherence page URL.
   */
  async openCoherencePage() {
    await this.page.goto(`/en/dho/${this.spaceSlug}/coherence`);
    await this.waitForPageLoad();
  }

  /**
   * Navigate directly to the create-signal form URL.
   */
  async openNewSignalPage() {
    await this.page.goto(`/en/dho/${this.spaceSlug}/coherence/new-signal`);
    await this.waitForPageLoad();
  }

  /**
   * Returns all visible signal type filter badge labels.
   * Expected values: ["All", "Opportunity", "Risk", "Tension", "Insight", "Trend", "Proposal"]
   */
  async getFilterBadgeLabels(): Promise<string[]> {
    // Signal type filter buttons rendered inside the signal section
    const badges = this.page.locator(
      '[data-testid="signal-type-filters"] button',
    );
    return badges.allTextContents();
  }

  /**
   * Returns the current URL path.
   */
  async getCurrentPath(): Promise<string> {
    return new URL(this.page.url()).pathname;
  }
}
