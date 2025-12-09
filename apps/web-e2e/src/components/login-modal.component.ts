import { Locator, Page } from '@playwright/test';

/**
 * Component Object for Privy Login Modal
 * Handles interactions with the Privy authentication modal
 *
 * Note: For most E2E tests, you should use the auth fixtures instead
 * of interacting with this modal directly. This component is useful
 * for testing the login flow itself or for manual auth scenarios.
 */
export class LoginModal {
  readonly page: Page;

  // Modal container - Privy uses iframe
  readonly modal: Locator;
  readonly privyIframe: Locator;

  // Header elements
  readonly loginButton: Locator;
  readonly signInButton: Locator;
  readonly getStartedButton: Locator;

  // Profile button (when logged in)
  readonly profileButton: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Privy modal (usually rendered as iframe)
    this.modal = page.locator('[id*="privy"], [class*="privy"]').first();
    this.privyIframe = page.frameLocator('iframe[src*="privy"]');

    // Header buttons for triggering login
    this.loginButton = page
      .getByTestId('login-button')
      .or(page.getByRole('button', { name: /sign in/i }));
    this.signInButton = page.getByRole('button', { name: /sign in/i });
    this.getStartedButton = page.getByRole('button', { name: /get started/i });

    // Profile elements (when logged in)
    this.profileButton = page
      .getByTestId('profile-button')
      .or(page.locator('[class*="ButtonProfile"]'));
    this.logoutButton = page.getByRole('menuitem', { name: /logout/i });
  }

  /**
   * Check if user is currently logged in
   */
  async isLoggedIn() {
    const profileVisible = await this.profileButton
      .isVisible()
      .catch(() => false);
    const signInVisible = await this.signInButton
      .isVisible()
      .catch(() => false);
    return profileVisible && !signInVisible;
  }

  /**
   * Check if login modal is visible
   */
  async isModalOpen() {
    return await this.modal.isVisible().catch(() => false);
  }

  /**
   * Open the login modal by clicking sign in button
   */
  async openLoginModal() {
    await this.signInButton.click();
    // Wait for modal to appear
    await this.page
      .waitForSelector('[id*="privy"], [class*="privy"]', {
        state: 'visible',
        timeout: 10000,
      })
      .catch(() => {
        // Privy might open in a new window or different element
      });
  }

  /**
   * Wait for login to complete
   * This waits for the profile button to appear
   */
  async waitForLogin(timeout: number = 60000) {
    await this.profileButton.waitFor({ state: 'visible', timeout });
  }

  /**
   * Logout the current user
   */
  async logout() {
    // Click profile button to open dropdown
    await this.profileButton.click();

    // Wait for dropdown to open
    await this.page.waitForTimeout(500);

    // Click logout
    await this.logoutButton.click();

    // Wait for logout to complete
    await this.signInButton.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Get the current user's address (if visible)
   */
  async getCurrentUserAddress() {
    // Open profile dropdown
    await this.profileButton.click();
    await this.page.waitForTimeout(500);

    // Look for address element
    const addressElement = this.page
      .locator('text=/0x[a-fA-F0-9]{4,}/')
      .first();
    const address = await addressElement.textContent().catch(() => null);

    // Close dropdown by clicking elsewhere
    await this.page.keyboard.press('Escape');

    return address;
  }

  /**
   * Enter email in Privy modal (for email login)
   * Note: This interacts with Privy's iframe
   */
  async enterEmail(email: string) {
    // Privy renders its UI in an iframe
    const emailInput = this.privyIframe.locator('input[type="email"]');
    await emailInput.fill(email);

    const continueButton = this.privyIframe.getByRole('button', {
      name: /continue/i,
    });
    await continueButton.click();
  }

  /**
   * Wait for email OTP input
   */
  async waitForOtpInput() {
    const otpInput = this.privyIframe.locator('input[type="text"]').first();
    await otpInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Check if sign in button is visible (user is logged out)
   */
  async isSignInVisible() {
    return await this.signInButton.isVisible().catch(() => false);
  }

  /**
   * Click get started button (alternative sign up flow)
   */
  async clickGetStarted() {
    await this.getStartedButton.click();
  }
}
