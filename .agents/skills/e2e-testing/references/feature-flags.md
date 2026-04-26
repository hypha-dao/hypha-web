# Feature Flags — E2E Testing Reference

## Architecture

Feature flags are **async helpers** in `@hypha-platform/feature-flags` (e.g. `getEnableHumanChat()`). They read **`next/headers` cookies** during SSR. **`FLAGS_SECRET`** is optional: without it, SSR still works. With it set on the deployment, the **Vercel Flags Toolbar** overrides in the **`vercel-flag-overrides`** cookie are decrypted (via the `flags` package) and applied **before** Hypha cookies / env — same order the old `flag()` runtime used.

### Evaluation Order

Each `get*` function:
1. If **`FLAGS_SECRET`** is set: use **Vercel toolbar override** for that flag key when present (`enable-human-chat`, `enable-coherence`, …).
2. Else: check **Hypha cookie** (e.g. `HYPHA_ENABLE_HUMAN_CHAT` — `false` opts out; unset uses default)
3. Else: **`NEXT_PUBLIC_*` env var** (e.g. `NEXT_PUBLIC_ENABLE_HUMAN_CHAT=false` to opt out)
4. Else: default — **Human Chat is on** unless opted out; other flags may still default to `false` (see `flagDefinitionsForDiscovery` and each `get*` implementation)

Source: `packages/feature-flags/src/index.ts`, `vercel-toolbar-overrides.ts`

### Cookie Constants

Canonical source: `packages/cookie/src/constants.ts`

| Cookie Name | Env Var Fallback | Controls |
|---|---|---|
| `HYPHA_ENABLE_HUMAN_CHAT` | `NEXT_PUBLIC_ENABLE_HUMAN_CHAT` | Human Chat right panel |
| `HYPHA_ENABLE_COHERENCE` | `NEXT_PUBLIC_ENABLE_COHERENCE` | Coherence tab (signals / conversations) |
| `HYPHA_ENABLE_AI_CHAT` | `NEXT_PUBLIC_ENABLE_AI_CHAT` | AI Chat left panel |
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
