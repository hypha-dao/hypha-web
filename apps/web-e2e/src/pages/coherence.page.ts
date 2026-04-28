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
 * - Search input
 * - "New Signal" button
 * - Create signal form navigation
 * - Unauthenticated "sign in to see" message
 */
export class CoherencePage extends BasePage {
  readonly spaceSlug: string;

  // ── Navigation ─────────────────────────────────────────────────────────────
  /**
   * The Signals (formerly Coherence) tab in the DHO **mobile** navigation bar.
   * Hidden on `md+` where navigation moves to the AI left panel.
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

  // ── Create signal form ─────────────────────────────────────────────────────
  /** Page heading of the create signal form */
  readonly createSignalHeading: Locator;

  constructor(page: Page, spaceSlug = 'hypha') {
    super(page);
    this.spaceSlug = spaceSlug;

    // Mobile-only horizontal tabs (`md:hidden`). Label i18n: Signals / Coherence per locale.
    this.coherenceTab = page.getByRole('tab', {
      name: /signals|coherence|cohérence|coerência|coherencia|kohärenz|signaux|señales|sinais|signale/i,
    });

    // Signal section label (SectionFilter: "{label} | {count}"; count omitted when 0)
    this.signalsSectionHeading = page.getByText(
      /^(signals|signaux|sinais|señales|signale)(\s*\|\s*\d+)?\s*$/i,
    );

    // "New Signal" link — CoherenceTab.newSignal full phrases per locale
    this.newSignalButton = page.getByRole('link', {
      name: /new signal|nouveau signal|neues signal|nueva señal|novo sinal/i,
    });

    // Search input — full placeholders from CoherenceTab.searchSignals (per locale)
    this.searchInput = page.getByPlaceholder(
      /Search signals|Buscar señales|Pesquisar sinais|Rechercher des signaux|Signale suchen/i,
    );

    // Unauthenticated sign-in prompt (CoherenceTab.signInToSee) — anchor on sign-in verb so we do not match the Space Memory heading alone
    this.signInMessage = page.getByText(
      /please,\s*sign\s+in\s+to\s+see|por\s+favor,\s+inicie\s+sesi[oó]n\s+para\s+ver|por\s+favor,\s+fa[cç]a\s+login\s+para\s+ver|veuillez\s+vous\s+connecter\s+pour\s+voir|bitte\s+melden\s+sie\s+sich\s+an/i,
    );

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
