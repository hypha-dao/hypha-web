import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Onboarding AI Hero', () => {
  test('renders hero input and keep onboarding cards', async ({ page }) => {
    await page.goto('/en/onboarding');
    const a11y = await new AxeBuilder({ page }).analyze();
    expect(a11y.violations).toEqual([]);

    await expect(
      page.getByRole('heading', { name: /Ready to give a vision/i }),
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Walk the network' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Create a space' }),
    ).toBeVisible();
  });
});
