import { expect, test, type Page } from '@playwright/test';

async function saveKeepsTheTabs(page: Page, path: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(path);
  await expect(page.getByTestId('e2e-quest-scroll-harness')).toBeVisible();

  const port = page.getByTestId('scrollport');
  const tabs = page.getByTestId('quest-scroll-tabs');
  const hero = page.getByTestId('quest-scroll-hero');

  await port.evaluate((el) => {
    el.scrollTop = 360;
  });
  const before = await tabs.evaluate((el) => el.getBoundingClientRect().top);
  const portTop = await port.evaluate((el) => el.getBoundingClientRect().top);

  await page.getByTestId('quest-scroll-save').click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-quest-scroll-settled',
    'ok',
    { timeout: 2000 },
  );

  const after = await tabs.evaluate((el) => el.getBoundingClientRect().top);
  const heroBottom = await hero.evaluate(
    (el) => el.getBoundingClientRect().bottom,
  );
  const scrollTop = await port.evaluate((el) => el.scrollTop);

  expect(Math.abs(after - before)).toBeLessThan(4);
  expect(heroBottom).toBeLessThanOrEqual(portTop + 2);
  expect(scrollTop).toBeGreaterThan(300);
}

test('settings save keeps the tabs in place when overview is shorter', async ({
  page,
}) => {
  await saveKeepsTheTabs(page, '/en/e2e/quest-scroll');
});

test('settings save keeps the tabs when a nested root is stuck at 0', async ({
  page,
}) => {
  await saveKeepsTheTabs(page, '/en/e2e/quest-scroll?nested=1');
});
