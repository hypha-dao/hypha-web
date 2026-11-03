import { expect, test, type Page } from '@playwright/test';

const HARNESS = '/en/e2e/emoji-picker';

async function openHarness(
  page: Page,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await page.goto(HARNESS);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('e2e-emoji-picker-harness')).toBeVisible();
  await expect(page.getByTestId('e2e-emoji-chat')).toBeVisible();
}

async function openPicker(
  page: Page,
  trigger: 'e2e-composer-emoji' | 'e2e-react-emoji',
) {
  await page.getByTestId(trigger).click();
  const host = page.locator('em-emoji-picker');
  await expect(host).toBeVisible({ timeout: 15_000 });
  return host;
}

async function measurePickerFill(page: Page) {
  const host = page.locator('em-emoji-picker');
  const panel = page.getByTestId('hypha-emoji-picker-panel');
  await expect(panel).toBeVisible();
  const sizes = await host.evaluate((element) => {
    const hostBox = element.getBoundingClientRect();
    const panelEl = element.closest('[data-testid="hypha-emoji-picker-panel"]');
    const panelBox = panelEl?.getBoundingClientRect();
    const root = element.shadowRoot?.getElementById('root');
    const firstRow = element.shadowRoot?.querySelector(
      '[role="grid"], .scroll [role="row"], .scroll',
    );
    return {
      hostWidth: hostBox.width,
      panelWidth: panelBox?.width ?? 0,
      rootWidth: root?.getBoundingClientRect().width ?? 0,
      scrollWidth: firstRow?.getBoundingClientRect().width ?? 0,
    };
  });
  expect(sizes.panelWidth).toBeGreaterThan(200);
  expect(sizes.hostWidth).toBeGreaterThan(200);
  expect(sizes.hostWidth).toBeGreaterThanOrEqual(sizes.panelWidth - 8);
  expect(sizes.rootWidth).toBeGreaterThanOrEqual(sizes.hostWidth - 8);
  return sizes;
}

test.describe('emoji picker width and sheet Escape', () => {
  test('desktop: both pickers fill the panel', async ({ page }) => {
    await openHarness(page, { width: 1280, height: 800 });

    await openPicker(page, 'e2e-composer-emoji');
    await measurePickerFill(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('em-emoji-picker')).toHaveCount(0);
    await expect(page.getByTestId('e2e-emoji-chat')).toBeVisible();

    await openPicker(page, 'e2e-react-emoji');
    await measurePickerFill(page);
  });

  test('390px: pickers fill the panel and Escape does not close the sheet', async ({
    page,
  }) => {
    await openHarness(page, { width: 390, height: 844 });
    await expect(page.locator('[data-mobile="true"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('e2e-emoji-sheet-open')).toBeVisible();

    await openPicker(page, 'e2e-composer-emoji');
    await measurePickerFill(page);

    await page.keyboard.press('Escape');
    await expect(page.locator('em-emoji-picker')).toHaveCount(0);
    await expect(page.getByTestId('e2e-emoji-sheet-open')).toBeVisible();
    await expect(page.locator('[data-mobile="true"]')).toBeVisible();
    await expect(page.getByTestId('e2e-emoji-chat')).toBeVisible();

    await openPicker(page, 'e2e-react-emoji');
    await measurePickerFill(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('em-emoji-picker')).toHaveCount(0);
    await expect(page.getByTestId('e2e-emoji-sheet-open')).toBeVisible();
  });
});
