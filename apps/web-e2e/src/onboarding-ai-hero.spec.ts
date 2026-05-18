import { expect, test } from '@playwright/test';

test.describe('Onboarding AI Hero', () => {
  test('renders hero input and keep onboarding cards', async ({ page }) => {
    await page.goto('/en/onboarding');

    await expect(
      page.getByText('Describe the space you want to create'),
    ).toBeVisible();
    await expect(page.getByLabel('AI onboarding prompt')).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Explore the Network' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Create your Space' }),
    ).toBeVisible();
  });
});
