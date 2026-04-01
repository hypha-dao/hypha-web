/**
 * E2E tests for the Coherence screen — written TDD-style.
 *
 * These tests are written BEFORE the feature is implemented and will initially
 * fail. They serve as the acceptance criteria for the implementation.
 *
 * E2E checkpoint table (from docs/plans/coherence-incremental-plan.md):
 *
 * | Test                                          | Passes after step |
 * |-----------------------------------------------|-------------------|
 * | Coherence tab appears in navigation           | Step 16           |
 * | Clicking coherence tab navigates to URL       | Step 16           |
 * | Coherence page renders (not auth-gated)       | Step 15           |
 * | "Sign in to see" shown when unauthenticated   | Step 12           |
 * | Signal section renders                        | Step 8 + 12 + 15  |
 * | Signal type filter badges are displayed       | Step 8 + 12       |
 * | "New Signal" button is visible                | Step 8 + 12       |
 * | Search input filters signals                  | Step 8 + 12       |
 * | Navigate to new-signal form                   | Step 11 + 15      |
 */

import { test, expect } from '@playwright/test';
import { CoherencePage } from './pages/coherence.page';

test.describe('Coherence Screen', () => {
  const SPACE_SLUG = 'hypha';
  const COHERENCE_PATH = `/en/dho/${SPACE_SLUG}/coherence`;

  test.describe('Navigation', () => {
    test('coherence tab appears in DHO navigation bar', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openDhoPage();

      await expect(coherencePage.coherenceTab).toBeVisible();
    });

    test('clicking coherence tab navigates to coherence URL', async ({
      page,
    }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openDhoPage();

      await coherencePage.coherenceTab.click();
      await expect(page).toHaveURL(new RegExp(COHERENCE_PATH));
    });

    test('coherence tab is active when on coherence page', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      // The active tab has data-state="active" on the TabsTrigger element
      const activeTab = page.locator('[data-state="active"]', {
        has: coherencePage.coherenceTab,
      });
      await expect(activeTab).toBeVisible();
    });
  });

  test.describe('Page Rendering', () => {
    test('coherence page renders without errors', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      // Page should not show a generic error state
      await expect(
        page.getByText('Something went wrong', { exact: false }),
      ).not.toBeVisible();

      // The page URL should match (no redirect to 404 or error page)
      await expect(page).toHaveURL(new RegExp(COHERENCE_PATH));
    });

    test('shows sign-in message when user is unauthenticated', async ({
      page,
    }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      // CoherenceBlock gates content behind authentication
      await expect(coherencePage.signInMessage).toBeVisible();
    });
  });

  test.describe('Signal Section', () => {
    test('signal section heading is rendered', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      await expect(coherencePage.signalsSectionHeading).toBeVisible();
    });

    test('"New Signal" button is visible', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      await expect(coherencePage.newSignalButton).toBeVisible();
    });

    test('signal type filter badges are displayed', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      // "All" badge is always the first filter option
      await expect(coherencePage.allFilterBadge).toBeVisible();
    });

    test('all signal type filter badges are rendered', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      // Expected: All + 6 signal types = 7 badges
      const expectedTypes = [
        'All',
        'Opportunity',
        'Risk',
        'Tension',
        'Insight',
        'Trend',
        'Proposal',
      ];

      for (const typeName of expectedTypes) {
        await expect(
          page.getByRole('button', { name: typeName }),
        ).toBeVisible();
      }
    });

    test('search input is visible', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      await expect(coherencePage.searchInput).toBeVisible();
    });

    test('search input accepts text input', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      await coherencePage.searchInput.fill('test search query');
      await expect(coherencePage.searchInput).toHaveValue('test search query');
    });

    test('signal section renders empty state or cards', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      // Either the empty state message or at least one signal card should be visible.
      // We assert at least one of the two states is present.
      const emptyState = page.getByText('List is empty', { exact: false });
      const signalCards = page.locator('[data-testid="signal-card"]');

      const emptyVisible = await emptyState.isVisible();
      const cardsCount = await signalCards.count();

      expect(emptyVisible || cardsCount > 0).toBeTruthy();
    });
  });

  test.describe('Create Signal Form', () => {
    test('"New Signal" button links to create-signal form', async ({
      page,
    }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      await coherencePage.newSignalButton.click();
      await expect(page).toHaveURL(new RegExp(`${COHERENCE_PATH}/new-signal`));
    });

    test('create-signal form renders on direct navigation', async ({
      page,
    }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openNewSignalPage();

      // Form heading from CoherenceTab.creatingNewSignal i18n key
      await expect(coherencePage.createSignalHeading).toBeVisible();
    });

    test('create-signal form has type selection buttons', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openNewSignalPage();

      // COHERENCE_TYPE_OPTIONS renders CoherenceTypeButton for each type
      const typeButtons = page.getByRole('button', {
        name: /Opportunity|Risk|Tension|Insight|Trend|Proposal/i,
      });
      await expect(typeButtons.first()).toBeVisible();
    });

    test('create-signal form has title input', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openNewSignalPage();

      // Signal title placeholder from CoherenceTab.signalTitle i18n key
      const titleInput = page.getByPlaceholder('Signal title...');
      await expect(titleInput).toBeVisible();
    });

    test('create-signal form has publish button', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openNewSignalPage();

      // Publish button from CoherenceTab.publish i18n key
      const publishButton = page.getByRole('button', { name: /publish/i });
      await expect(publishButton).toBeVisible();
    });
  });
});
