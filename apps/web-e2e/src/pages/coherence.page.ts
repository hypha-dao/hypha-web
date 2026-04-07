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
    this.coherenceTab = page.getByRole('tab', {
      name: /coherence|cohérence|coerência|coherencia|kohärenz/i,
    });

    // Signal section label (SectionFilter: "{label} | {count}")
    this.signalsSectionHeading = page.getByText(
      /^(signals|signaux|sinais|señales|signale)\s*\|/i,
    );

    // "New Signal" link — wraps a Button inside a <Link>
    this.newSignalButton = page.getByRole('link', {
      name: /new signal|nouveau signal|neuer|nueva|novo/i,
    });

    // Search input — placeholder from CoherenceTab.searchSignals (localized)
    this.searchInput = page.getByPlaceholder(
      /signals|signaux|sinais|señales|signale|suchen|pesquisar|buscar|rechercher/i,
    );

    // Unauthenticated sign-in prompt (CoherenceTab.signInToSee, localized)
    this.signInMessage = page.getByText(
      /sign in|inicie sesión|connectez|faça login|melden sie sich/i,
      { exact: false },
    );

    // Filter badges rendered as <div> (Badge component), matched by visible text.
    // Note: Badge renders as div, so use getByText not getByRole('button').
    this.allFilterBadge = page.getByText(/^(all|todos|tous|alle)\s/i).first();

    // Loading overlay copy (CoherenceTab.creatingNewSignal) — rendered as text, not a heading
    this.createSignalHeading = page.getByText(
      /creating new signal|création d'un nouveau signal|neues signal wird erstellt|creando nueva señal|criando novo sinal/i,
    );
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
   * NOTE: Direct navigation to /coherence/new-signal does NOT work.
   * The create-signal form lives in @aside/[tab]/new-signal (parallel route)
   * and is only reachable via soft navigation (clicking "New Signal" button
   * on the coherence page while authenticated).
   *
   * To access the form in tests: open coherence page (with auth), then click
   * newSignalButton — this triggers Next.js soft navigation that resolves both
   * @tab (coherence content) and @aside (CreateSignalForm SidePanel).
   */

  /**
   * Returns the current URL path.
   */
  async getCurrentPath(): Promise<string> {
    return new URL(this.page.url()).pathname;
  }
}
