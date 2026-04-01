# Writing E2E Tests — Reference

## Project Structure

```text
apps/web-e2e/
├── playwright.config.ts          # CI config (starts production server)
├── playwright-local.config.ts    # Local dev config (no webServer)
├── src/
│   ├── pages/                    # Page Object Models
│   │   ├── base.page.ts          # Base class with common helpers
│   │   ├── human-chat-panel.page.ts
│   │   ├── ai-chat-panel.page.ts
│   │   ├── layout.page.ts
│   │   └── coherence.page.ts
│   ├── components/               # Component Object Models
│   │   ├── recommended-spaces.component.ts
│   │   └── member-spaces.component.ts
│   └── *.spec.ts                 # Test specs
```

## Page Object Pattern

All page objects extend `BasePage`:

```typescript
import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class MyFeaturePage extends BasePage {
  readonly myButton: Locator;
  readonly myInput: Locator;

  constructor(page: Page) {
    super(page);
    this.myButton = page.getByRole('button', { name: /my button/i });
    this.myInput = page.getByPlaceholder('Type something...');
  }

  async open(slug = 'hypha') {
    await this.page.goto(`/en/dho/${slug}/agreements`);
    await this.waitForPageLoad();
  }

  async clickMyButton() {
    await this.myButton.click();
  }
}
```

`BasePage` provides:
- `this.page` — the Playwright `Page` instance
- `waitForPageLoad()` — waits for `domcontentloaded`

## Spec File Template

```typescript
import { test, expect } from '@playwright/test';
import { MyFeaturePage } from './pages/my-feature.page';

test.describe('My Feature', () => {
  let featurePage: MyFeaturePage;

  // Required if feature is behind a flag
  test.use({
    extraHTTPHeaders: {
      Cookie: 'HYPHA_ENABLE_HUMAN_CHAT=true',
    },
  });

  test.beforeEach(async ({ page, context }) => {
    // Set cookies for client-side navigation
    await context.addCookies([
      {
        name: 'HYPHA_ENABLE_HUMAN_CHAT',
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);

    featurePage = new MyFeaturePage(page);
    await featurePage.open();
  });

  test('should render my feature', async () => {
    await expect(featurePage.myButton).toBeVisible();
  });
});
```

## Locator Strategy (Preferred Order)

1. `page.getByRole()` — best for accessibility, mirrors user interaction
2. `page.getByText()` / `page.getByPlaceholder()` — user-visible text
3. `page.getByTestId()` / `page.locator('[data-testid="..."]')` — explicit test hooks
4. `page.locator('[class*="..."]')` — last resort, fragile

## Mocking API Routes

Use `page.route()` to intercept API calls:

```typescript
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/people/me', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        name: 'Test',
        surname: 'User',
        avatarUrl: 'https://example.com/avatar.png',
      }),
    });
  });
});
```

> Route interception must be set up BEFORE `page.goto()`.

## Running Commands

```bash
# Run all e2e tests
npx playwright test --config=apps/web-e2e/playwright-local.config.ts

# Run a specific spec file
npx playwright test --config=apps/web-e2e/playwright-local.config.ts apps/web-e2e/src/my-feature.spec.ts

# Run tests matching a name pattern
npx playwright test --config=apps/web-e2e/playwright-local.config.ts --grep "should render"

# Run headed (visible browser)
npx playwright test --config=apps/web-e2e/playwright-local.config.ts --headed

# Run with Playwright UI mode (interactive)
npx playwright test --config=apps/web-e2e/playwright-local.config.ts --ui

# Show HTML report after failure
npx playwright show-report dist/.playwright/apps/web-e2e/playwright-report
```

## Common Data Test IDs in the Codebase

| `data-testid` | Component | Location |
|---|---|---|
| `chat-message-avatar` | PersonAvatar in message bubble | `human-chat-panel-message-bubble.tsx` |
| `data-sidebar` attributes | Sidebar panels | `@hypha-platform/ui` sidebar components |
| `data-side="right"` | Human chat panel sidebar | Layout wrapper |
| `data-side="left"` | AI chat panel sidebar | Layout wrapper |

## Timing & Stability Tips

- Use `await expect(locator).toBeVisible()` instead of `waitForSelector` — auto-retries
- Set `--timeout=20000` for local runs (Turbopack compilation can be slow)
- Warm up routes with `curl` before running tests on a fresh dev server
- For slow-loading pages, use `page.waitForLoadState('networkidle')` sparingly
