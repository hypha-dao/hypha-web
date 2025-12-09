import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { VotingForm } from '../components/voting-form.component';

/**
 * Page Object for Proposal Detail pages
 * Handles viewing and interacting with individual proposals
 */
export class ProposalDetailPage extends BasePage {
  // Voting form component
  readonly votingForm: VotingForm;

  // Proposal content elements
  readonly proposalTitle: Locator;
  readonly proposalDescription: Locator;
  readonly proposalCreator: Locator;
  readonly proposalStatus: Locator;

  // Proposal metadata
  readonly createdDate: Locator;
  readonly endDate: Locator;
  readonly commitmentBadge: Locator;

  // Navigation
  readonly backButton: Locator;
  readonly votersLink: Locator;

  // Status indicators
  readonly acceptedBadge: Locator;
  readonly rejectedBadge: Locator;
  readonly onVotingBadge: Locator;
  readonly expiredBadge: Locator;

  constructor(page: Page) {
    super(page);

    // Initialize voting form component
    this.votingForm = new VotingForm(page);

    // Proposal content
    this.proposalTitle = page.getByTestId('proposal-title');
    this.proposalDescription = page.getByTestId('proposal-description');
    this.proposalCreator = page.getByTestId('proposal-creator');
    this.proposalStatus = page.getByTestId('proposal-status');

    // Metadata
    this.createdDate = page.getByTestId('proposal-created-date');
    this.endDate = page.getByTestId('proposal-end-date');
    this.commitmentBadge = page.getByTestId('commitment-badge');

    // Navigation
    this.backButton = page.getByRole('button', { name: /back/i });
    this.votersLink = page.getByRole('link', { name: /voters|see all/i });

    // Status badges
    this.acceptedBadge = page.locator('text=/accepted/i');
    this.rejectedBadge = page.locator('text=/rejected/i');
    this.onVotingBadge = page.locator('text=/on voting|active/i');
    this.expiredBadge = page.locator('text=/expired/i');
  }

  /**
   * Navigate to a specific proposal
   */
  async open(spaceSlug: string, proposalSlug: string, lang: string = 'en') {
    await this.page.goto(
      `/${lang}/dho/${spaceSlug}/agreements/proposal/${proposalSlug}`,
    );
    await this.waitForPageLoad();
    await this.waitForProposalLoad();
  }

  /**
   * Wait for proposal data to load
   */
  async waitForProposalLoad() {
    // Wait for either the voting form or proposal content to appear
    await this.page
      .waitForSelector(
        '[data-testid="voting-form"], [data-testid="proposal-title"]',
        {
          state: 'visible',
          timeout: 15000,
        },
      )
      .catch(() => {
        // Fallback: wait for any heading
        return this.page.waitForSelector('h1, h2', {
          state: 'visible',
          timeout: 10000,
        });
      });
  }

  /**
   * Get proposal information
   */
  async getProposalInfo() {
    return {
      title: await this.proposalTitle.textContent().catch(() => null),
      description: await this.proposalDescription
        .textContent()
        .catch(() => null),
      creator: await this.proposalCreator.textContent().catch(() => null),
      status: await this.getStatus(),
    };
  }

  /**
   * Get the current status of the proposal
   */
  async getStatus(): Promise<
    'accepted' | 'rejected' | 'onVoting' | 'expired' | 'unknown'
  > {
    if (await this.acceptedBadge.isVisible().catch(() => false))
      return 'accepted';
    if (await this.rejectedBadge.isVisible().catch(() => false))
      return 'rejected';
    if (await this.onVotingBadge.isVisible().catch(() => false))
      return 'onVoting';
    if (await this.expiredBadge.isVisible().catch(() => false))
      return 'expired';
    return 'unknown';
  }

  /**
   * Check if voting is available for this proposal
   */
  async canVote() {
    return await this.votingForm.isVotingAvailable();
  }

  /**
   * Vote yes on the proposal
   */
  async voteYes() {
    await this.votingForm.voteYes();
  }

  /**
   * Vote no on the proposal
   */
  async voteNo() {
    await this.votingForm.voteNo();
  }

  /**
   * Get the user's current vote on this proposal
   */
  async getMyVote() {
    return await this.votingForm.getMyVote();
  }

  /**
   * Navigate to the voters list
   */
  async goToVoters() {
    await this.votersLink.click();
    await this.waitForPageLoad();
  }

  /**
   * Go back to the previous page
   */
  async goBack() {
    await this.backButton.click();
    await this.waitForPageLoad();
  }
}
