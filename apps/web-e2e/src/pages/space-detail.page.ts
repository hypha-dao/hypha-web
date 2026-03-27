import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object for Space Detail pages
 * Handles navigation and interactions within a specific space (DHO)
 */
export class SpaceDetailPage extends BasePage {
  // Navigation tabs
  readonly overviewTab: Locator;
  readonly agreementsTab: Locator;
  readonly membersTab: Locator;
  readonly treasuryTab: Locator;

  // Space header elements
  readonly spaceTitle: Locator;
  readonly spaceLogo: Locator;
  readonly spaceDescription: Locator;
  readonly memberCount: Locator;
  readonly agreementCount: Locator;

  // Action buttons
  readonly joinSpaceButton: Locator;
  readonly createAgreementButton: Locator;
  readonly settingsButton: Locator;

  // Space configuration badge
  readonly sandboxBadge: Locator;
  readonly demoBadge: Locator;

  constructor(page: Page) {
    super(page);

    // Navigation tabs
    this.overviewTab = page.getByRole('link', { name: /overview/i });
    this.agreementsTab = page.getByRole('link', { name: /agreements/i });
    this.membersTab = page.getByRole('link', { name: /members/i });
    this.treasuryTab = page.getByRole('link', { name: /treasury/i });

    // Space header
    this.spaceTitle = page.getByTestId('space-title');
    this.spaceLogo = page.getByTestId('space-logo');
    this.spaceDescription = page.getByTestId('space-description');
    this.memberCount = page.getByTestId('member-count');
    this.agreementCount = page.getByTestId('agreement-count');

    // Actions
    this.joinSpaceButton = page.getByRole('button', { name: /join/i });
    this.createAgreementButton = page.getByRole('button', { name: /create/i });
    this.settingsButton = page.getByTestId('settings-button');

    // Badges
    this.sandboxBadge = page.getByText('Sandbox');
    this.demoBadge = page.getByText('Demo');
  }

  /**
   * Navigate to a space by slug
   */
  async open(spaceSlug: string, lang: string = 'en') {
    await this.page.goto(`/${lang}/dho/${spaceSlug}/agreements`);
    await this.waitForPageLoad();
  }

  /**
   * Navigate to space overview tab
   */
  async goToOverview() {
    await this.overviewTab.click();
    await this.waitForPageLoad();
  }

  /**
   * Navigate to agreements tab
   */
  async goToAgreements() {
    await this.agreementsTab.click();
    await this.waitForPageLoad();
  }

  /**
   * Navigate to members tab
   */
  async goToMembers() {
    await this.membersTab.click();
    await this.waitForPageLoad();
  }

  /**
   * Navigate to treasury tab
   */
  async goToTreasury() {
    await this.treasuryTab.click();
    await this.waitForPageLoad();
  }

  /**
   * Click the join space button
   */
  async joinSpace() {
    await this.joinSpaceButton.click();
    // Wait for join action to complete
    await this.page.waitForResponse(
      (response) =>
        response.url().includes('/api') && response.status() === 200,
      { timeout: 30000 },
    );
  }

  /**
   * Open the create agreement modal/page
   */
  async openCreateAgreement() {
    await this.createAgreementButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Get space information
   */
  async getSpaceInfo() {
    const title = await this.spaceTitle.textContent().catch(() => null);
    const description = await this.spaceDescription
      .textContent()
      .catch(() => null);
    const isSandbox = await this.sandboxBadge.isVisible().catch(() => false);
    const isDemo = await this.demoBadge.isVisible().catch(() => false);

    return {
      title,
      description,
      isSandbox,
      isDemo,
    };
  }

  /**
   * Check if user can interact with space (is member)
   */
  async canInteract() {
    // If create agreement button is enabled, user is a member
    const createButton = this.createAgreementButton;
    const isVisible = await createButton.isVisible().catch(() => false);
    const isEnabled = await createButton.isEnabled().catch(() => false);
    return isVisible && isEnabled;
  }

  /**
   * Wait for space data to load
   */
  async waitForSpaceLoad() {
    await this.page.waitForSelector('[data-testid="space-title"], h1', {
      state: 'visible',
      timeout: 15000,
    });
  }
}
