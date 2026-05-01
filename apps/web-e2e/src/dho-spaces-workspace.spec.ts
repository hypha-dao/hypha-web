import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const SPACE = 'hypha';
const SPACES = `/en/dho/${SPACE}/spaces`;
const LEGACY_NAV = `/en/dho/${SPACE}/agreements/select-navigation-action`;
const SPACES_DE = `/de/dho/${SPACE}/spaces`;

test.describe('DHO spaces tab and workspace (hardening)', () => {
  test.beforeEach(async ({ context }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'http://127.0.0.1:3000';
    await context.addCookies([
      {
        name: 'HYPHA_ENABLE_AI_CHAT',
        value: 'true',
        url: baseURL,
      },
    ]);
  });

  test('legacy select-navigation-action URL redirects to in-flow /spaces', async ({
    page,
  }) => {
    await page.goto(LEGACY_NAV, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL((url) => url.pathname === SPACES);
  });

  test('legacy redirect response exposes x-hypha-legacy-redirect', async ({
    request,
  }) => {
    const r = await request.get(LEGACY_NAV, {
      maxRedirects: 0,
    });
    expect(
      r.status() >= 300 && r.status() < 400,
      'expected redirect to /spaces',
    ).toBeTruthy();
    expect(r.headers()['x-hypha-legacy-redirect']).toBe('dho-spaces');
  });

  test('spaces main column and space navigation view are axe-clean', async ({
    page,
  }) => {
    await page.goto(SPACES);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('dho-workspace-main')).toBeVisible();
    await expect(page.getByTestId('dho-space-navigation-view')).toBeVisible();

    for (const sel of [
      '[data-testid="dho-workspace-main"]',
      '[data-testid="dho-space-navigation-view"]',
    ] as const) {
      const a11y = await new AxeBuilder({ page })
        .include(sel)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        a11y.violations,
        `axe violations in ${sel}: ` + JSON.stringify(a11y.violations, null, 2),
      ).toEqual([]);
    }
  });

  test('german /spaces: rail uses translated nav and tab labels', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(SPACES_DE);
    await page.waitForLoadState('domcontentloaded');

    const spaceNav = page.getByRole('navigation', { name: 'Space-Bereiche' });
    await expect(spaceNav).toBeVisible();
    await expect(
      spaceNav.getByRole('link', { name: 'Ökosystem' }),
    ).toHaveAttribute('aria-current', 'page');
    const tabs = page.getByTestId('dho-space-nav-map-tabs');
    await expect(
      tabs.getByRole('tab', { name: 'Verschachtelte Spaces' }),
    ).toBeVisible();
  });

  test('left rail and Spaces link have current state on /spaces (desktop, en)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(SPACES);
    await page.waitForLoadState('domcontentloaded');

    const spaceNav = page.getByRole('navigation', { name: 'Space sections' });
    await expect(spaceNav).toBeVisible();

    const ecosystemLink = spaceNav.getByRole('link', { name: 'Ecosystem' });
    await expect(ecosystemLink).toHaveAttribute('aria-current', 'page');
  });

  test('ecosystem tab strip and spaces panel use the same column width (desktop)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(SPACES);
    await page.waitForLoadState('domcontentloaded');

    const tabs = page.getByTestId('dho-space-nav-ecosystem-tabs');
    const panel = page.getByTestId('dho-ecosystem-spaces-panel');
    await expect(tabs).toBeVisible();
    await expect(panel).toBeVisible();

    const tabsBox = await tabs.boundingBox();
    const panelBox = await panel.boundingBox();
    expect(tabsBox && panelBox).toBeTruthy();
    expect(
      Math.abs(tabsBox!.width - panelBox!.width),
      `tab list width ${tabsBox!.width} vs panel ${panelBox!.width}`,
    ).toBeLessThanOrEqual(2);
  });

  test('opening AI left panel shifts main column bounds', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(SPACES);
    await page.waitForLoadState('domcontentloaded');

    const main = page.getByTestId('dho-workspace-main');
    const box0 = (await main.boundingBox())!;
    expect(box0).toBeTruthy();

    await page.getByRole('button', { name: /open hypha ai panel/i }).click();
    await expect(page.getByText('Hypha AI', { exact: true })).toBeVisible();

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

    await page.getByRole('button', { name: /space menu/i }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();

    const agreements = sheet.getByRole('link', { name: 'Agreements' });
    await expect(agreements).toBeVisible();
    await expect(agreements).toBeEnabled();
  });
});
