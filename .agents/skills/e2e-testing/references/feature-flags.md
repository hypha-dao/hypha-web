# Feature Flags — E2E Testing Reference

## Architecture

Feature flags are **async helpers** in `@hypha-platform/feature-flags` (e.g. `getEnableHumanChat()`). They read **`next/headers` cookies** during SSR in the root layout (`apps/web/src/app/layout.tsx`). This avoids `flags@4` runtime serialization, which required **`FLAGS_SECRET`** and caused **500** on Vercel previews when unset.

### Evaluation Order

Each `get*` function:
1. Checks for a **cookie** by name (e.g., `HYPHA_ENABLE_HUMAN_CHAT`)
2. Falls back to a **`NEXT_PUBLIC_*` env var** (e.g., `NEXT_PUBLIC_ENABLE_HUMAN_CHAT`)
3. Uses the documented default (typically `false`) if neither is set

Source: `packages/feature-flags/src/index.ts`

### Cookie Constants

Canonical source: `packages/cookie/src/constants.ts`

| Cookie Name | Env Var Fallback | Controls |
|---|---|---|
| `HYPHA_ENABLE_HUMAN_CHAT` | `NEXT_PUBLIC_ENABLE_HUMAN_CHAT` | Human Chat right panel |
| `HYPHA_ENABLE_COHERENCE` | `NEXT_PUBLIC_ENABLE_COHERENCE` | Coherence tab (signals / conversations) |
| `HYPHA_ENABLE_AI_CHAT` | `NEXT_PUBLIC_ENABLE_AI_CHAT` | AI Chat left panel |
| `HYPHA_AUTH_PROVIDER` | *(none — cookie only)* | Auth provider selection (`web3auth`) |
| `HYPHA_SHOW_LANGUAGE_SELECT` | *(none — cookie only)* | i18n language selector |

## Why Cookies Alone Don't Work in E2E

`next/headers` `cookies()` reads from the **incoming HTTP request** during SSR. Playwright's `context.addCookies()` sets cookies in the browser's cookie jar, but these are sent by the browser on **subsequent** requests — **not** on the first `page.goto()` navigation that was already in-flight when cookies were added.

### The Fix: Two-Layer Cookie Strategy

```typescript
// Layer 1: extraHTTPHeaders — sent on the INITIAL SSR request
test.use({
  extraHTTPHeaders: {
    Cookie: 'HYPHA_ENABLE_HUMAN_CHAT=true; HYPHA_ENABLE_AI_CHAT=true',
  },
});

// Layer 2: addCookies — persisted for client-side navigations
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: 'HYPHA_ENABLE_HUMAN_CHAT',
      value: 'true',
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
});
```

### Multiple Flags

Concatenate cookies with `;` in the header:

```typescript
test.use({
  extraHTTPHeaders: {
    Cookie: 'HYPHA_ENABLE_AI_CHAT=true; HYPHA_ENABLE_HUMAN_CHAT=true',
  },
});
```

And add each to `addCookies` separately.

## Proven Pattern (from panel-layout.spec.ts)

This is the working pattern used in the codebase:

```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  // Layer 1: SSR cookie
  test.use({
    extraHTTPHeaders: {
      Cookie: 'HYPHA_ENABLE_HUMAN_CHAT=true',
    },
  });

  test.beforeEach(async ({ page, context }) => {
    // Layer 2: Browser cookie jar
    await context.addCookies([
      {
        name: 'HYPHA_ENABLE_HUMAN_CHAT',
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);

    await page.goto('/en/dho/hypha/agreements');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should see the chat panel trigger', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /open chat panel/i })
    ).toBeVisible();
  });
});
```

## Debugging Feature Flag Issues

| Symptom | Cause | Fix |
|---|---|---|
| Button/panel not rendered at all | Flag evaluated `false` during SSR | Add `extraHTTPHeaders` with Cookie |
| Works on reload but not first load | Only `addCookies` was set (no SSR header) | Add `test.use({ extraHTTPHeaders })` |
| `NEXT_PUBLIC_*` env var set but tests still fail | Env var is build-time, dev server wasn't restarted | Restart dev server or use cookie approach |
| Flag works in browser DevTools but not in Playwright | DevTools modifies runtime state, not SSR | Use both cookie layers |

## Env Var Approach (Alternative)

If you control the dev server startup, you can set the env var directly:

```bash
NEXT_PUBLIC_ENABLE_HUMAN_CHAT=true pnpm dev
```

Or add to `apps/web/.env`:

```dotenv
NEXT_PUBLIC_ENABLE_HUMAN_CHAT=true
```

This makes the flag `true` for all requests, no cookies needed. But the cookie approach is preferred in e2e tests because it's explicit and doesn't require server restart.
