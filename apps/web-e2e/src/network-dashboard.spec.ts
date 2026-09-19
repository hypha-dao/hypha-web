import { test, expect } from '@playwright/test';
import { gotoApp } from './utils/nav-url';

test.describe('Network dashboard', () => {
  test('renders snapshot metrics above the spaces list', async ({ page }) => {
    await gotoApp(page, '/en/network');
    await page.waitForLoadState('domcontentloaded');

    const dashboard = page.getByTestId('network-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 30_000 });
    await expect(
      dashboard.getByText('Spaces (total)', { exact: true }),
    ).toBeVisible();
    await expect(dashboard.getByText('Contributing spaces')).toBeVisible();
    await expect(dashboard.getByText('Active spaces')).toHaveCount(0);
    await expect(dashboard.getByText('Network growth')).toBeVisible();
    await expect(dashboard.getByText('Proposals by type')).toHaveCount(0);
    await expect(dashboard.getByText('Paying spaces')).toHaveCount(0);
    await expect(dashboard.getByText(/placeholder test spaces/i)).toBeVisible();
  });
});
