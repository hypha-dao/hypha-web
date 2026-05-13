import path from 'node:path';
import { expect, test } from '@playwright/test';
import { gotoApp } from './utils/nav-url';

const SPACE_CREATE_PATH = '/en/dho/hypha/ecosystem-navigation/space/create';
const TEST_IMAGE_PATH = path.resolve(
  process.cwd(),
  'apps/web/public/exchange-logos/wirex.png',
);

test.describe('Create Space modal', () => {
  test('locks submit after first create attempt to prevent duplicates', async ({
    page,
  }) => {
    await gotoApp(page, SPACE_CREATE_PATH);
    await page.waitForLoadState('domcontentloaded');

    await page
      .getByPlaceholder(/name your space/i)
      .fill('Playwright duplicate guard');
    await page
      .locator('textarea')
      .first()
      .fill(
        'Space created from regression test to verify duplicate prevention.',
      );

    const fileInputs = page.locator('input[type="file"]');
    await expect(fileInputs.first()).toBeAttached();
    await fileInputs.nth(0).setInputFiles(TEST_IMAGE_PATH);
    await fileInputs.nth(1).setInputFiles(TEST_IMAGE_PATH);
    await page.getByRole('button', { name: /crop & save/i }).click();

    const submitButton = page.getByRole('button', { name: /create space/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(submitButton).toBeDisabled();
  });
});
