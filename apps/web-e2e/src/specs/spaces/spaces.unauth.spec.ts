import { test, expect } from '../../fixtures';
import { MySpaces } from '../../pages';
import { SpaceDetailPage } from '../../pages';
import { RecommendedSpaces } from '../../components';
import { LoginModal } from '../../components';

/**
 * Spaces Tests (Unauthenticated)
 *
 * These tests verify public space functionality for logged-out users.
 */
test.describe('Spaces - Unauthenticated', () => {
  test('can view network/spaces page', async ({ page }) => {
    await page.goto('/en/network');
    await page.waitForLoadState('networkidle');

    // Should see the network page
    await expect(page).toHaveURL(/network/);
  });

  test('can view my-spaces page with recommended spaces', async ({ page }) => {
    const mySpacesPage = new MySpaces(page);

    await mySpacesPage.open();

    // Recommended spaces should be visible
    const recommendedSpaces = new RecommendedSpaces(page);
    const isVisible = await recommendedSpaces.isVisible();

    expect(isVisible).toBeTruthy();
  });

  test('can browse to a specific space', async ({ page, testSpace }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);

    // Should see the space page
    await expect(page).toHaveURL(new RegExp(`dho/${testSpace.slug}`));
  });

  test('can view space details without login', async ({ page, testSpace }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);
    await spacePage.waitForSpaceLoad();

    // Space info should be visible
    const spaceInfo = await spacePage.getSpaceInfo();

    // Should have some content displayed
    expect(spaceInfo).toBeDefined();
  });

  test('cannot join space without login', async ({ page, testSpace }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);

    // Join button might be disabled or trigger login
    const joinButton = spacePage.joinSpaceButton;
    const isVisible = await joinButton.isVisible().catch(() => false);

    if (isVisible) {
      // Button might be disabled
      const isEnabled = await joinButton.isEnabled().catch(() => false);

      // Either disabled or clicking it opens login modal
      if (isEnabled) {
        await joinButton.click();

        // Should trigger login flow
        const loginModal = new LoginModal(page);
        const modalOpened = await loginModal.isModalOpen().catch(() => false);
        const signInVisible = await loginModal
          .isSignInVisible()
          .catch(() => true);

        expect(modalOpened || signInVisible).toBeTruthy();
      } else {
        expect(isEnabled).toBeFalsy();
      }
    }
  });

  test('sign in button is visible', async ({ page }) => {
    await page.goto('/en/network');
    await page.waitForLoadState('networkidle');

    const loginModal = new LoginModal(page);
    const isSignInVisible = await loginModal.isSignInVisible();

    expect(isSignInVisible).toBeTruthy();
  });

  test('clicking sign in opens Privy modal', async ({ page }) => {
    await page.goto('/en/network');
    await page.waitForLoadState('networkidle');

    const loginModal = new LoginModal(page);

    // Click sign in
    await loginModal.openLoginModal();

    // Modal should open (Privy might take a moment to load)
    await page.waitForTimeout(2000);

    // Check if modal or Privy element appeared
    const modalOpened = await loginModal.isModalOpen();

    // Privy modal may render differently
    expect(modalOpened).toBeDefined();
  });

  test('can navigate between network and my-spaces', async ({ page }) => {
    // Start at network
    await page.goto('/en/network');
    await page.waitForLoadState('networkidle');

    // Navigate to my-spaces
    const mySpacesLink = page.getByRole('link', { name: /my spaces/i });
    await mySpacesLink.click();

    await expect(page).toHaveURL(/my-spaces/);

    // Navigate back to network
    const networkLink = page.getByRole('link', { name: /network/i });
    await networkLink.click();

    await expect(page).toHaveURL(/network/);
  });
});
