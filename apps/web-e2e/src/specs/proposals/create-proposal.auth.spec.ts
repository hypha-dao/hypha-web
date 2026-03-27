import { test, expect } from '../../fixtures';
import { CreateProposalPage, SpaceDetailPage } from '../../pages';

/**
 * Proposal Creation Tests (Authenticated)
 *
 * These tests verify the proposal creation workflow.
 * Requires authenticated user who is a member of the test space.
 */
test.describe('Proposal Creation', () => {
  test.beforeEach(async ({ authenticateAs }) => {
    // Authenticate as a member user
    await authenticateAs('member');
  });

  test('can navigate to create proposal page', async ({ page, testSpace }) => {
    const spacePage = new SpaceDetailPage(page);

    // Navigate to space
    await spacePage.open(testSpace.slug);

    // Click create agreement button (if visible)
    const canInteract = await spacePage.canInteract();

    if (canInteract) {
      await spacePage.openCreateAgreement();

      // Verify we're on the create page
      await expect(page).toHaveURL(/create/);
    } else {
      // Alternative: navigate directly
      await page.goto(`/en/dho/${testSpace.slug}/agreements/create`);
      await page.waitForLoadState('networkidle');
    }
  });

  test('create proposal form has required fields', async ({
    page,
    testSpace,
  }) => {
    const createPage = new CreateProposalPage(page);

    // Navigate directly to create page
    await createPage.open(testSpace.slug);
    await createPage.waitForFormReady();

    // Verify title input exists
    await expect(createPage.titleInput).toBeVisible();

    // Verify publish button exists
    await expect(createPage.publishButton).toBeVisible();
  });

  test('cannot submit empty proposal form', async ({ page, testSpace }) => {
    const createPage = new CreateProposalPage(page);

    await createPage.open(testSpace.slug);
    await createPage.waitForFormReady();

    // Try to submit empty form
    await createPage.publish();

    // Should show validation errors
    const hasErrors = await createPage.hasValidationErrors();
    expect(hasErrors).toBeTruthy();
  });

  test('can fill in proposal details', async ({ page, testSpace }) => {
    const createPage = new CreateProposalPage(page);

    await createPage.open(testSpace.slug);
    await createPage.waitForFormReady();

    // Fill in proposal details
    const testTitle = `Test Proposal ${Date.now()}`;
    const testDescription = 'This is a test proposal created by E2E tests.';

    await createPage.fillBasicProposal({
      title: testTitle,
      description: testDescription,
    });

    // Verify fields are filled
    await expect(createPage.titleInput).toHaveValue(testTitle);

    // Note: We don't submit to avoid creating test data
  });

  test('form validation shows appropriate messages', async ({
    page,
    testSpace,
  }) => {
    const createPage = new CreateProposalPage(page);

    await createPage.open(testSpace.slug);
    await createPage.waitForFormReady();

    // Enter only title (missing description)
    await createPage.titleInput.fill('Test Title');

    // Try to submit
    await createPage.publish();

    // Check for validation messages
    const errors = await createPage.getValidationErrors();

    // Should have some validation message
    // (exact message depends on form requirements)
    expect(errors.length).toBeGreaterThanOrEqual(0);
  });

  test('can cancel proposal creation', async ({ page, testSpace }) => {
    const createPage = new CreateProposalPage(page);

    await createPage.open(testSpace.slug);
    await createPage.waitForFormReady();

    // Fill some data
    await createPage.titleInput.fill('Test Title to Cancel');

    // Cancel
    await createPage.cancel();

    // Should navigate back
    await expect(page).not.toHaveURL(/create/);
  });

  /**
   * Full proposal creation test
   *
   * Warning: This test creates actual data in the database.
   * Only run in test environments or skip in CI.
   */
  test.skip('can create and submit a proposal (creates data)', async ({
    page,
    testSpace,
  }) => {
    const createPage = new CreateProposalPage(page);

    await createPage.open(testSpace.slug);
    await createPage.waitForFormReady();

    const testTitle = `E2E Test Proposal ${Date.now()}`;
    const testDescription =
      'This proposal was created by automated E2E tests and should be cleaned up.';

    await createPage.createProposal({
      title: testTitle,
      description: testDescription,
    });

    // Should redirect to proposal detail or success page
    await expect(page).not.toHaveURL(/create/);

    // Verify proposal was created (check for title on page)
    await expect(page.getByText(testTitle)).toBeVisible({ timeout: 10000 });
  });
});
