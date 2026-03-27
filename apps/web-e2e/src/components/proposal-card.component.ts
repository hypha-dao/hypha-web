import { Locator, Page } from '@playwright/test';

/**
 * Component Object for Proposal/Document Cards
 * Handles interactions with proposal cards in lists
 */
export class ProposalCard {
  readonly page: Page;
  readonly container: Locator;

  // Card elements
  readonly title: Locator;
  readonly description: Locator;
  readonly status: Locator;
  readonly creator: Locator;
  readonly date: Locator;

  // Vote button on card
  readonly voteButton: Locator;

  constructor(page: Page, index?: number) {
    this.page = page;

    // Get specific card by index or first one
    if (index !== undefined) {
      this.container = page
        .getByTestId('proposal-card')
        .nth(index)
        .or(page.locator('[class*="DocumentCard"]').nth(index));
    } else {
      this.container = page
        .getByTestId('proposal-card')
        .first()
        .or(page.locator('[class*="DocumentCard"]').first());
    }

    // Card content
    this.title = this.container.locator('[class*="title"], h3, h4').first();
    this.description = this.container
      .locator('[class*="description"], p')
      .first();
    this.status = this.container
      .locator('[class*="badge"], [class*="status"]')
      .first();
    this.creator = this.container
      .locator('[class*="creator"], [class*="author"]')
      .first();
    this.date = this.container.locator('[class*="date"], time').first();

    // Vote button
    this.voteButton = this.container.getByRole('button', {
      name: /vote|voted/i,
    });
  }

  /**
   * Check if card is visible
   */
  async isVisible() {
    return await this.container.isVisible().catch(() => false);
  }

  /**
   * Click on the card to navigate to detail page
   */
  async click() {
    await this.container.click();
  }

  /**
   * Get card information
   */
  async getInfo() {
    return {
      title: await this.title.textContent().catch(() => null),
      description: await this.description.textContent().catch(() => null),
      status: await this.status.textContent().catch(() => null),
      creator: await this.creator.textContent().catch(() => null),
      date: await this.date.textContent().catch(() => null),
    };
  }

  /**
   * Click the vote button on the card
   */
  async clickVoteButton() {
    await this.voteButton.click();
  }

  /**
   * Get vote button text
   */
  async getVoteButtonText() {
    return await this.voteButton.textContent().catch(() => null);
  }

  /**
   * Check if user has voted (based on button text)
   */
  async hasVoted() {
    const text = await this.getVoteButtonText();
    return text?.toLowerCase().includes('voted') ?? false;
  }
}

/**
 * Helper to get all proposal cards on a page
 */
export class ProposalCardList {
  readonly page: Page;
  readonly container: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator(
      '[data-testid="proposal-card"], [class*="DocumentCard"]',
    );
  }

  /**
   * Get count of visible proposal cards
   */
  async count() {
    return await this.container.count();
  }

  /**
   * Get a specific card by index
   */
  getCard(index: number) {
    return new ProposalCard(this.page, index);
  }

  /**
   * Get all card titles
   */
  async getAllTitles(): Promise<string[]> {
    const count = await this.count();
    const titles: string[] = [];

    for (let i = 0; i < count; i++) {
      const card = this.getCard(i);
      const info = await card.getInfo();
      if (info.title) {
        titles.push(info.title);
      }
    }

    return titles;
  }

  /**
   * Find a card by title
   */
  async findByTitle(title: string): Promise<ProposalCard | null> {
    const count = await this.count();

    for (let i = 0; i < count; i++) {
      const card = this.getCard(i);
      const info = await card.getInfo();
      if (info.title?.toLowerCase().includes(title.toLowerCase())) {
        return card;
      }
    }

    return null;
  }
}
