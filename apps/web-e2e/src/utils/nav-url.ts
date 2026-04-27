import type { Page } from '@playwright/test';

/**
 * Default matches `playwright.config.ts` when `BASE_URL` is unset.
 * Ensures `page.goto` works when Playwright runs without that config (e.g. wrong CWD),
 * where `use.baseURL` is missing and relative URLs throw "Cannot navigate to invalid URL".
 */
const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

function resolveBaseUrl(): string {
  return process.env['BASE_URL']?.trim() || DEFAULT_BASE_URL;
}

/**
 * Absolute URL for an app-relative path (must start with `/`).
 */
export function resolveAppUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalized, resolveBaseUrl()).href;
}

/** Navigate using the same base URL convention as the Playwright config. */
export async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(resolveAppUrl(path));
}
