import { Locator, Page } from '@playwright/test';

/**
 * Component Object for the Voting Form
 * Handles interactions with the proposal voting UI
 */
export class VotingForm {
  readonly page: Page;
  readonly container: Locator;

  // Voting buttons
  readonly voteYesButton: Locator;
  readonly voteNoButton: Locator;

  // Progress indicators
  readonly unityProgress: Locator;
  readonly quorumProgress: Locator;
  readonly unityPercentage: Locator;
  readonly quorumPercentage: Locator;

  // Status messages
  readonly votedMessage: Locator;
  readonly timeRemaining: Locator;

  // Vote confirmation/status
  readonly votedYesIndicator: Locator;
  readonly votedNoIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main container
    this.container = page
      .getByTestId('voting-form')
      .or(page.locator('[class*="FormVoting"]'));

    // Vote buttons - handle different label variations
    this.voteYesButton = page
      .getByTestId('vote-yes-button')
      .or(
        page.getByRole('button', {
          name: /vote yes|consent|hell yeah|looks good/i,
        }),
      );
    this.voteNoButton = page
      .getByTestId('vote-no-button')
      .or(page.getByRole('button', { name: /vote no|object|no|not sure/i }));

    // Progress indicators
    this.unityProgress = page
      .getByTestId('unity-progress')
      .or(page.locator('[class*="unity"]').first());
    this.quorumProgress = page
      .getByTestId('quorum-progress')
      .or(page.locator('[class*="quorum"]').first());
    this.unityPercentage = page.getByTestId('unity-percentage');
    this.quorumPercentage = page.getByTestId('quorum-percentage');

    // Status messages
    this.votedMessage = page.locator('text=/You voted/i');
    this.timeRemaining = page
      .getByTestId('time-remaining')
      .or(page.locator('text=/remaining|closing|days|hours/i').first());

    // Vote status indicators
    this.votedYesIndicator = page.locator('text=/You voted yes/i');
    this.votedNoIndicator = page.locator('text=/You voted no/i');
  }

  /**
   * Check if the voting form is visible
   */
  async isVisible() {
    return await this.container.isVisible().catch(() => false);
  }

  /**
   * Check if voting is currently available (buttons enabled)
   */
  async isVotingAvailable() {
    const yesEnabled = await this.voteYesButton.isEnabled().catch(() => false);
    const noEnabled = await this.voteNoButton.isEnabled().catch(() => false);
    return yesEnabled || noEnabled;
  }

  /**
   * Vote yes on the proposal
   */
  async voteYes() {
    await this.voteYesButton.click();
    // Wait for vote to be processed
    await this.waitForVoteConfirmation();
  }

  /**
   * Vote no on the proposal
   */
  async voteNo() {
    await this.voteNoButton.click();
    // Wait for vote to be processed
    await this.waitForVoteConfirmation();
  }

  /**
   * Wait for vote confirmation to appear
   */
  async waitForVoteConfirmation() {
    // Wait for either the voted message or button state change
    await Promise.race([
      this.votedMessage.waitFor({ state: 'visible', timeout: 30000 }),
      this.voteYesButton.waitFor({ state: 'disabled', timeout: 30000 }),
      this.voteNoButton.waitFor({ state: 'disabled', timeout: 30000 }),
    ]).catch(() => {
      // Timeout is acceptable - some votes may not show confirmation
    });

    // Additional wait for any loading to complete
    await this.page
      .waitForLoadState('networkidle', { timeout: 10000 })
      .catch(() => {});
  }

  /**
   * Get the user's current vote
   */
  async getMyVote(): Promise<'yes' | 'no' | null> {
    if (await this.votedYesIndicator.isVisible().catch(() => false)) {
      return 'yes';
    }
    if (await this.votedNoIndicator.isVisible().catch(() => false)) {
      return 'no';
    }
    return null;
  }

  /**
   * Get voting statistics
   */
  async getVotingStats() {
    return {
      unity: await this.unityPercentage.textContent().catch(() => null),
      quorum: await this.quorumPercentage.textContent().catch(() => null),
      timeRemaining: await this.timeRemaining.textContent().catch(() => null),
    };
  }

  /**
   * Check if the proposal has been executed/settled
   */
  async isSettled() {
    // Check if voting buttons are hidden/disabled due to settlement
    const yesVisible = await this.voteYesButton.isVisible().catch(() => false);
    const noVisible = await this.voteNoButton.isVisible().catch(() => false);

    // If buttons are not visible, proposal may be settled
    return !yesVisible && !noVisible;
  }

  /**
   * Get the tooltip message (for disabled states)
   */
  async getTooltipMessage() {
    const yesButton = await this.voteYesButton;
    return await yesButton.getAttribute('title');
  }
}
