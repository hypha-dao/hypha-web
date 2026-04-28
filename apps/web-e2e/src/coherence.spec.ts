/**
 * E2E tests for the Coherence screen.
 *
 * Written TDD-style — some tests pass immediately after implementation,
 * others are marked fixme until auth fixtures or future routes are added.
 *
 * E2E checkpoint table (from docs/plans/coherence-incremental-plan.md):
 *
 * | Test                                          | Passes after step |
 * |-----------------------------------------------|-------------------|
 * | Coherence tab appears in navigation           | Step 16  ✅       |
 * | Clicking coherence tab navigates to URL       | Step 16  ✅       |
 * | Coherence page renders (not auth-gated)       | Step 15  ✅       |
 * | "Sign in to see" shown when unauthenticated   | Step 12  ✅       |
 * | Signal section renders                        | Steps 8+12+15 (auth required) |
 * | "New Signal" button is visible                | Steps 8+12    (auth required) |
 * | Search input filters signals                  | Steps 8+12    (auth required) |
 * | Navigate to new-signal form                   | Steps 11+15   (route pending) |
 */

import { test, expect } from '@playwright/test';
import { CoherencePage } from './pages/coherence.page';

test.describe('Coherence Screen', () => {
  const SPACE_SLUG = 'hypha';
  const COHERENCE_PATH = `/en/dho/${SPACE_SLUG}/coherence`;

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  test.describe('Navigation', () => {
    // Horizontal tabs are `md:hidden`; use a mobile viewport so the tab strip is in the DOM.
    test.beforeEach(async ({ context, page }) => {
      await context.addCookies([
        {
          name: 'HYPHA_ENABLE_COHERENCE',
          value: 'true',
          domain: '127.0.0.1',
          path: '/',
        },
      ]);
      await page.setViewportSize({ width: 390, height: 844 });
    });

    test('coherence tab appears in DHO navigation bar', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openDhoPage();

      // TabsTrigger with asChild renders as role="tab" on the <a> element
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

    test('coherence tab has correct href', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openDhoPage();

      await expect(coherencePage.coherenceTab).toHaveAttribute(
        'href',
        COHERENCE_PATH,
      );
    });

    test('coherence tab is active when on coherence page', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      // With Radix TabsTrigger asChild, data-state="active" is set on the <a> element itself
      await expect(coherencePage.coherenceTab).toHaveAttribute(
        'data-state',
        'active',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Page Rendering (unauthenticated)
  // ---------------------------------------------------------------------------
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

    test('signal section is not visible when unauthenticated', async ({
      page,
    }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      // When unauthenticated, CoherenceBlock only shows the sign-in prompt
      await expect(coherencePage.newSignalButton).not.toBeVisible();
      await expect(coherencePage.searchInput).not.toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Signal Section — requires authentication
  // These tests are marked fixme until an auth fixture is available.
  // Implementation: CoherenceBlock only renders SignalSection when isAuthenticated.
  // TODO: Add auth setup (cookie/JWT) and remove fixme.
  // ---------------------------------------------------------------------------
  test.describe('Signal Section (authenticated)', () => {
    test.fixme(
      'signal section label "Signals" is rendered',
      async ({ page }) => {
        const coherencePage = new CoherencePage(page, SPACE_SLUG);
        await coherencePage.openCoherencePage();

        await expect(coherencePage.signalsSectionHeading).toBeVisible();
      },
    );

    test.fixme('"New Signal" button is visible', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      await expect(coherencePage.newSignalButton).toBeVisible();
    });

    test.fixme('search input is visible', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      await expect(coherencePage.searchInput).toBeVisible();
    });

    test.fixme('search input accepts text input', async ({ page }) => {
      const coherencePage = new CoherencePage(page, SPACE_SLUG);
      await coherencePage.openCoherencePage();

      await coherencePage.searchInput.fill('test search query');
      await expect(coherencePage.searchInput).toHaveValue('test search query');
    });

    test.fixme(
      'signal section renders empty state or cards',
      async ({ page }) => {
        const coherencePage = new CoherencePage(page, SPACE_SLUG);
        await coherencePage.openCoherencePage();

        const emptyState = page.getByText('List is empty', { exact: false });
        const signalCards = page.locator('[data-testid="signal-card"]');

        const emptyVisible = await emptyState.isVisible();
        const cardsCount = await signalCards.count();

        expect(emptyVisible || cardsCount > 0).toBeTruthy();
      },
    );
  });

  // ---------------------------------------------------------------------------
  // Create Signal Form
  //
  // ROUTING NOTE: The form lives in @aside/[tab]/new-signal/page.tsx and is
  // rendered in a SidePanel overlay on top of the coherence page content.
  // It is only accessible via SOFT navigation (clicking "New Signal" from
  // within the app), NOT direct/hard URL navigation. Direct navigation to
  // /coherence/new-signal 404s because the @tab parallel route has no
  // coherence/new-signal sub-route.
  //
  // All tests here require authentication to:
  //   1. See the SignalSection (CoherenceBlock gates content behind auth)
  //   2. Click "New Signal" to trigger the soft navigation
  //
  // TODO: Add an auth fixture (JWT/cookie) and remove fixme.
  // ---------------------------------------------------------------------------
  test.describe('Create Signal Form', () => {
    test.fixme(
      '"New Signal" button navigates to aside form panel (requires auth)',
      async ({ page }) => {
        // With auth: click "New Signal" → soft navigation to /coherence/new-signal
        // → @tab shows coherence content, @aside renders CreateSignalForm in SidePanel
        const coherencePage = new CoherencePage(page, SPACE_SLUG);
        await coherencePage.openCoherencePage();

        await coherencePage.newSignalButton.click();
        await expect(page).toHaveURL(
          new RegExp(`${COHERENCE_PATH}/new-signal`),
        );
      },
    );

    test.fixme(
      'create-signal form is visible after clicking New Signal (requires auth)',
      async ({ page }) => {
        // Form is rendered in the @aside SidePanel slot after soft navigation.
        // Direct URL navigation (/coherence/new-signal) 404s — test via click.
        const coherencePage = new CoherencePage(page, SPACE_SLUG);
        await coherencePage.openCoherencePage();

        await coherencePage.newSignalButton.click();

        // Form heading from CoherenceTab.creatingNewSignal i18n key
        await expect(coherencePage.createSignalHeading).toBeVisible();
      },
    );

    test.fixme(
      'create-signal form has type selection buttons (requires auth)',
      async ({ page }) => {
        const coherencePage = new CoherencePage(page, SPACE_SLUG);
        await coherencePage.openCoherencePage();
        await coherencePage.newSignalButton.click();

        // COHERENCE_TYPE_OPTIONS renders CoherenceTypeButton for each type
        const typeButtons = page.getByRole('button', {
          name: /Opportunity|Risk|Tension|Insight|Trend|Proposal/i,
        });
        await expect(typeButtons.first()).toBeVisible();
      },
    );

    test.fixme(
      'create-signal form has title input (requires auth)',
      async ({ page }) => {
        const coherencePage = new CoherencePage(page, SPACE_SLUG);
        await coherencePage.openCoherencePage();
        await coherencePage.newSignalButton.click();

        // Signal title placeholder from CoherenceTab.signalTitle i18n key
        const titleInput = page.getByPlaceholder('Signal title...');
        await expect(titleInput).toBeVisible();
      },
    );

    test.fixme(
      'create-signal form has publish button (requires auth)',
      async ({ page }) => {
        const coherencePage = new CoherencePage(page, SPACE_SLUG);
        await coherencePage.openCoherencePage();
        await coherencePage.newSignalButton.click();

        // Publish button from CoherenceTab.publish i18n key
        const publishButton = page.getByRole('button', { name: /publish/i });
        await expect(publishButton).toBeVisible();
      },
    );
  });
});
