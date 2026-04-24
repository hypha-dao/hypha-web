import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const SPACE = 'hypha';
const SPACES = `/en/dho/${SPACE}/spaces`;
const LEGACY_NAV = `/en/dho/${SPACE}/agreements/select-navigation-action`;

const AI_HEADER = { Cookie: 'HYPHA_ENABLE_AI_CHAT=true' };

test.describe('DHO spaces tab and workspace (Phase 4)', () => {
  test.use({
    extraHTTPHeaders: AI_HEADER,
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'HYPHA_ENABLE_AI_CHAT',
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
  });

  test('legacy select-navigation-action URL redirects to in-flow /spaces', async ({
    page,
  }) => {
    await page.goto(LEGACY_NAV, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`${SPACES.replace(/\//g, '\\/')}`));
  });

  test('spaces page shows space navigation copy and no critical axe issues in main column', async ({
    page,
  }) => {
    await page.goto(SPACES);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByText('Space Navigation', { exact: true }),
    ).toBeVisible();

    const main = page.getByTestId('dho-workspace-main');
    await expect(main).toBeVisible();

    const a11y = await new AxeBuilder({ page })
      .include('[data-testid="dho-workspace-main"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(a11y.violations, JSON.stringify(a11y.violations, null, 2)).toEqual(
      [],
    );
  });

  test('left rail and Spaces link have current state on /spaces (desktop)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(SPACES);
    await page.waitForLoadState('domcontentloaded');

    const spaceNav = page.getByRole('navigation', { name: 'Space sections' });
    await expect(spaceNav).toBeVisible();

    const spacesLink = spaceNav.getByRole('link', { name: 'Spaces' });
    await expect(spacesLink).toHaveAttribute('aria-current', 'page');
  });

  test('opening AI left panel shifts main column bounds', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(SPACES);
    await page.waitForLoadState('domcontentloaded');

    const main = page.getByTestId('dho-workspace-main');
    const box0 = (await main.boundingBox())!;
    expect(box0).toBeTruthy();

    await page.getByRole('button', { name: /open hypha ai panel/i }).click();
    await expect(
      page.getByRole('button', { name: /open hypha ai panel/i }),
    ).toHaveCount(0);

    await expect
      .poll(
        async () => {
          const b = await main.boundingBox();
          return b?.x ?? 0;
        },
        { timeout: 5000 },
      )
      .toBeGreaterThanOrEqual((box0?.x ?? 0) + 8);
  });

  test('mobile: Space menu sheet opens and Agreements link is reachable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(SPACES);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('navigation', { name: 'Space sections' }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Space menu' }).click();
    const sheet = page.locator('#dho-workspace-menu');
    await expect(sheet).toBeVisible();

    const agreements = sheet.getByRole('link', { name: 'Agreements' });
    await expect(agreements).toBeVisible();
    await expect(agreements).toBeEnabled();
  });
});
