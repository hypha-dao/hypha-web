import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
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
    let createCalls = 0;
    await page.route('**/api/v1/spaces*', async (route) => {
      if (route.request().method() === 'POST') {
        createCalls += 1;
      }
      await route.fallback();
    });

    await gotoApp(page, SPACE_CREATE_PATH);
    await page.waitForLoadState('domcontentloaded');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await page
      .getByPlaceholder(/name your space/i)
      .fill('Playwright duplicate guard');
    await page
      .getByRole('textbox', { name: /purpose/i })
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
    await submitButton.click({ force: true }).catch(() => {});
    expect(createCalls).toBeLessThanOrEqual(1);
  });
});
