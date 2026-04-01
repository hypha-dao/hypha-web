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
  /**
   * The "Coherence" tab in the DHO navigation bar.
   * Rendered as role="tab" (Radix TabsTrigger with asChild merges onto the Link).
   */
  readonly coherenceTab: Locator;

  // ── Page content ───────────────────────────────────────────────────────────
  /** Main "Signals" section heading / label */
  readonly signalsSectionHeading: Locator;

  /** "New Signal" link button in the signal section */
  readonly newSignalButton: Locator;

  /** Search signals input field */
  readonly searchInput: Locator;

  /** "Sign in to see signals and conversations" message (unauthenticated state) */
  readonly signInMessage: Locator;

  // ── Signal type filter badges ───────────────────────────────────────────────
  /**
   * "All" filter badge.
   * Rendered as a <div> (Badge component), not a <button>.
   * Matched by text content.
   */
  readonly allFilterBadge: Locator;

  // ── Create signal form ─────────────────────────────────────────────────────
  /** Page heading of the create signal form */
  readonly createSignalHeading: Locator;

  constructor(page: Page, spaceSlug = 'hypha') {
    super(page);
    this.spaceSlug = spaceSlug;

    // Navigation tab — TabsTrigger with asChild merges role="tab" onto the <a> Link
    this.coherenceTab = page.getByRole('tab', { name: 'Coherence' });

    // Signal section label (rendered via SectionFilter's label prop, not a heading element)
    this.signalsSectionHeading = page.getByText('Signals', { exact: true });

    // "New Signal" link — wraps a Button inside a <Link>
    this.newSignalButton = page.getByRole('link', { name: 'New Signal' });

    // Search input — placeholder defined in CoherenceTab.searchSignals i18n key
    this.searchInput = page.getByPlaceholder('Search signals...');

    // Unauthenticated sign-in prompt
    this.signInMessage = page.getByText(
      'Please, sign in to see signals and conversations',
      { exact: false },
    );

    // Filter badges rendered as <div> (Badge component), matched by visible text.
    // Note: Badge renders as div, so use getByText not getByRole('button').
    this.allFilterBadge = page.getByText('All', { exact: false }).first();

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
   * Returns the current URL path.
   */
  async getCurrentPath(): Promise<string> {
    return new URL(this.page.url()).pathname;
  }
}
