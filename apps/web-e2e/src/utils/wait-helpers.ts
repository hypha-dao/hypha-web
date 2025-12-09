import { Page, expect } from '@playwright/test';

/**
 * Custom Wait Helpers
 *
 * Utility functions for common wait patterns in E2E tests.
 */

/**
 * Wait for the page to be fully loaded and interactive
 */
export async function waitForPageReady(page: Page, timeout: number = 30000) {
  await page.waitForLoadState('domcontentloaded', { timeout });
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {
    // Network idle might timeout on pages with real-time updates
    console.log('Network idle timeout - continuing');
  });
}

/**
 * Wait for all loading skeletons to disappear
 */
export async function waitForSkeletonsToDisappear(
  page: Page,
  timeout: number = 15000,
) {
  const skeletons = page.locator('[class*="skeleton"], [class*="Skeleton"]');
  const count = await skeletons.count();

  if (count > 0) {
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        skeletons
          .nth(i)
          .waitFor({ state: 'hidden', timeout })
          .catch(() => {}),
      ),
    );
  }
}

/**
 * Wait for loading spinners to disappear
 */
export async function waitForSpinnersToDisappear(
  page: Page,
  timeout: number = 15000,
) {
  const spinners = page.locator(
    '[class*="spinner"], [class*="Spinner"], [class*="loading"], .animate-spin',
  );

  const count = await spinners.count();

  if (count > 0) {
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        spinners
          .nth(i)
          .waitFor({ state: 'hidden', timeout })
          .catch(() => {}),
      ),
    );
  }
}

/**
 * Wait for loading backdrop to disappear
 */
export async function waitForLoadingBackdrop(
  page: Page,
  timeout: number = 60000,
) {
  const backdrop = page.locator(
    '[data-testid="loading-backdrop"], [class*="LoadingBackdrop"]',
  );

  const isVisible = await backdrop.isVisible().catch(() => false);

  if (isVisible) {
    await backdrop.waitFor({ state: 'hidden', timeout });
  }
}

/**
 * Wait for a specific API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options?: {
    status?: number;
    timeout?: number;
  },
) {
  const { status = 200, timeout = 30000 } = options || {};

  return page.waitForResponse(
    (response) => {
      const matchesUrl =
        typeof urlPattern === 'string'
          ? response.url().includes(urlPattern)
          : urlPattern.test(response.url());
      const matchesStatus = response.status() === status;
      return matchesUrl && matchesStatus;
    },
    { timeout },
  );
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = 30000,
) {
  await page.waitForURL(urlPattern, { timeout });
  await waitForPageReady(page);
}

/**
 * Retry an action until it succeeds or times out
 */
export async function retry<T>(
  action: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    delayMs?: number;
    shouldRetry?: (error: Error) => boolean;
  },
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    shouldRetry = () => true,
  } = options || {};

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts && shouldRetry(lastError)) {
        console.log(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Wait for element to be stable (not moving/animating)
 */
export async function waitForElementStable(
  page: Page,
  selector: string,
  timeout: number = 5000,
) {
  const element = page.locator(selector);

  // Wait for element to exist
  await element.waitFor({ state: 'visible', timeout });

  // Wait for position to stabilize
  let previousBox = await element.boundingBox();
  let stable = false;
  const startTime = Date.now();

  while (!stable && Date.now() - startTime < timeout) {
    await page.waitForTimeout(100);
    const currentBox = await element.boundingBox();

    if (
      previousBox &&
      currentBox &&
      previousBox.x === currentBox.x &&
      previousBox.y === currentBox.y &&
      previousBox.width === currentBox.width &&
      previousBox.height === currentBox.height
    ) {
      stable = true;
    }

    previousBox = currentBox;
  }
}

/**
 * Wait for toast notification to appear and optionally disappear
 */
export async function waitForToast(
  page: Page,
  options?: {
    message?: string | RegExp;
    type?: 'success' | 'error' | 'info' | 'warning';
    waitForDismiss?: boolean;
    timeout?: number;
  },
) {
  const {
    message,
    type,
    waitForDismiss = false,
    timeout = 10000,
  } = options || {};

  // Common toast selectors
  let toastSelector = '[role="alert"], [class*="toast"], [class*="Toast"]';

  if (type) {
    toastSelector += `, [class*="${type}"]`;
  }

  const toast = page.locator(toastSelector).first();

  // Wait for toast to appear
  await toast.waitFor({ state: 'visible', timeout });

  // Optionally verify message
  if (message) {
    await expect(toast).toContainText(message, { timeout });
  }

  // Optionally wait for dismiss
  if (waitForDismiss) {
    await toast.waitFor({ state: 'hidden', timeout: 15000 });
  }

  return toast;
}
