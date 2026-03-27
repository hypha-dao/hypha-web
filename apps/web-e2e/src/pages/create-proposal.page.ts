import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object for Create Proposal/Agreement pages
 * Handles the proposal creation flow
 */
export class CreateProposalPage extends BasePage {
  // Form fields
  readonly titleInput: Locator;
  readonly descriptionEditor: Locator;
  readonly commitmentInput: Locator;

  // Action buttons
  readonly publishButton: Locator;
  readonly backButton: Locator;
  readonly closeButton: Locator;

  // Creator info
  readonly creatorAvatar: Locator;
  readonly creatorName: Locator;

  // Form validation messages
  readonly validationMessages: Locator;

  // Loading/Progress indicators
  readonly loadingBackdrop: Locator;
  readonly progressIndicator: Locator;

  constructor(page: Page) {
    super(page);

    // Form fields
    this.titleInput = page
      .getByTestId('proposal-title-input')
      .or(page.getByPlaceholder(/title/i));
    this.descriptionEditor = page
      .getByTestId('proposal-description-editor')
      .or(page.locator('[contenteditable="true"]').first());
    this.commitmentInput = page
      .getByTestId('commitment-input')
      .or(page.getByLabel(/commitment/i));

    // Buttons
    this.publishButton = page.getByRole('button', { name: /publish/i });
    this.backButton = page.getByRole('button', { name: /back/i });
    this.closeButton = page
      .getByTestId('close-button')
      .or(page.getByRole('button', { name: /close|cancel/i }));

    // Creator info
    this.creatorAvatar = page.getByTestId('creator-avatar');
    this.creatorName = page.getByTestId('creator-name');

    // Validation
    this.validationMessages = page.locator(
      '[class*="FormMessage"], [class*="error"]',
    );

    // Loading states
    this.loadingBackdrop = page
      .getByTestId('loading-backdrop')
      .or(page.locator('[class*="LoadingBackdrop"]'));
    this.progressIndicator = page.locator('[class*="progress"]');
  }

  /**
   * Navigate to create agreement page for a space
   */
  async open(spaceSlug: string, lang: string = 'en') {
    await this.page.goto(`/${lang}/dho/${spaceSlug}/agreements/create`);
    await this.waitForPageLoad();
  }

  /**
   * Navigate to a specific proposal type creation page
   */
  async openProposalType(
    spaceSlug: string,
    proposalType: string,
    lang: string = 'en',
  ) {
    await this.page.goto(
      `/${lang}/dho/${spaceSlug}/agreements/create/${proposalType}`,
    );
    await this.waitForPageLoad();
  }

  /**
   * Fill in the basic proposal fields
   */
  async fillBasicProposal(options: {
    title: string;
    description: string;
    commitment?: number;
  }) {
    // Fill title
    await this.titleInput.fill(options.title);

    // Fill description (contenteditable)
    await this.descriptionEditor.click();
    await this.descriptionEditor.fill(options.description);

    // Fill commitment if provided
    if (options.commitment !== undefined) {
      await this.commitmentInput.fill(options.commitment.toString());
    }
  }

  /**
   * Submit the proposal form
   */
  async publish() {
    await this.publishButton.click();

    // Wait for submission to start
    await this.page.waitForTimeout(500);

    // Wait for loading to complete (if shown)
    const hasLoading = await this.loadingBackdrop
      .isVisible()
      .catch(() => false);
    if (hasLoading) {
      await this.loadingBackdrop.waitFor({ state: 'hidden', timeout: 60000 });
    }
  }

  /**
   * Check if form has validation errors
   */
  async hasValidationErrors() {
    await this.page.waitForTimeout(100); // Allow validation to trigger
    return await this.validationMessages
      .first()
      .isVisible()
      .catch(() => false);
  }

  /**
   * Get all validation error messages
   */
  async getValidationErrors(): Promise<string[]> {
    const messages = await this.validationMessages.allTextContents();
    return messages.filter((msg) => msg.trim().length > 0);
  }

  /**
   * Check if publish button is enabled
   */
  async canPublish() {
    return await this.publishButton.isEnabled();
  }

  /**
   * Cancel and go back
   */
  async cancel() {
    await this.backButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Close the modal/form
   */
  async close() {
    await this.closeButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Wait for form to be ready
   */
  async waitForFormReady() {
    await this.titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.publishButton.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Fill and submit a complete proposal
   */
  async createProposal(options: {
    title: string;
    description: string;
    commitment?: number;
  }) {
    await this.waitForFormReady();
    await this.fillBasicProposal(options);
    await this.publish();
  }
}
