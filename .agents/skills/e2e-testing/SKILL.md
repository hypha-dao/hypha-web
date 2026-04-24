---
name: e2e-testing
description: |
  Run and write Playwright e2e tests for hypha-web. Handles dev server startup
  (with Zellij pane support), feature flag cookies, and test execution.
  Use when: running e2e tests, debugging test failures, writing new spec files,
  or asking "run tests", "e2e", "playwright", "test the chat panel", "test this feature".
  Also trigger when test output shows feature-flag-related failures (missing buttons,
  elements not found) or cookie/SSR issues.
  Do NOT use for unit tests, component tests, or non-Playwright testing.
---

# E2E Testing — hypha-web

Run and author Playwright e2e tests against the Next.js dev server, handling feature flags, cookies, and terminal multiplexer panes.

## Workflow

### 1. Start the Dev Server

The dev server must be running on `http://127.0.0.1:3000` before tests execute.

**If inside Zellij** (`$ZELLIJ` is set):
```bash
# Open a new pane, start the dev server, then return focus
zellij action new-pane --direction down -- bash -c "cd $(pwd) && pnpm dev"
sleep 3  # let Turbopack start compiling
zellij action focus-previous-pane
```

**If inside tmux** (`$TMUX` is set):
```bash
tmux split-window -v "cd $(pwd) && pnpm dev"
tmux select-pane -t 0
```

**Otherwise** (no multiplexer):
```bash
pnpm dev &
DEV_PID=$!
```

After starting, wait for the server to be ready:
```bash
for i in $(seq 1 30); do
  curl -sf -o /dev/null http://127.0.0.1:3000 && break
  sleep 2
done
```

> Warm up the specific route before running tests — first Turbopack compile can take 15-30s:
> `curl -sf -o /dev/null "http://127.0.0.1:3000/en/dho/hypha/agreements"`

### 2. Enable Feature Flags

Feature flags are SSR-evaluated in `@hypha-platform/feature-flags` (see [references/feature-flags.md](references/feature-flags.md)) — **Hypha cookies** and **`NEXT_PUBLIC_*` env**, with product flags defaulting **on** when unset.

**Quick reference — two layers are needed in e2e tests:**

| Layer | Why | How |
|---|---|---|
| `test.use({ extraHTTPHeaders })` | Sends cookie on the **initial SSR request** so the server-rendered HTML includes the feature | `Cookie: 'HYPHA_ENABLE_HUMAN_CHAT=true'` |
| `context.addCookies()` | Persists cookie for **subsequent client-side navigations** | `{ name, value, domain: '127.0.0.1', path: '/' }` |

Both layers are required. Cookie-only (`addCookies`) does NOT work alone because Next.js SSR reads headers before the browser cookie jar is consulted.

### 3. Run Tests

Use the local Playwright config (no webServer block — assumes server already running):

```bash
npx playwright test \
  --config=apps/web-e2e/playwright-local.config.ts \
  apps/web-e2e/src/<spec-file>.spec.ts \
  --timeout=20000 \
  --reporter=line
```

To run a single test by name:
```bash
npx playwright test --config=apps/web-e2e/playwright-local.config.ts --grep "test name"
```

### 4. Debug Failures

1. **"element not found" / timeout on trigger button** → Feature flag not enabled. Check both `extraHTTPHeaders` and `addCookies` are set. See [references/feature-flags.md](references/feature-flags.md).
2. **`net::ERR_ABORTED; maybe frame was detached?`** → Dev server still compiling. Warm up the route first.
3. **`EADDRINUSE`** → Port 3000 already in use. Use `playwright-local.config.ts` (no webServer block) or kill the existing process.

### 5. Write New Tests

Follow existing Page Object pattern:
- **Page objects**: `apps/web-e2e/src/pages/<name>.page.ts`
- **Specs**: `apps/web-e2e/src/<name>.spec.ts`

For the full spec authoring guide and examples, read [references/writing-tests.md](references/writing-tests.md).

## Rules

- **Always** use `playwright-local.config.ts` when a dev server is already running
- **Always** set feature flag cookies via BOTH `extraHTTPHeaders` and `addCookies` — see [references/feature-flags.md](references/feature-flags.md)
- **Never** use `playwright.config.ts` in dev — it runs `npx nx start web` which requires a production build
- **Never** assume `NEXT_PUBLIC_*` env vars are set — always set cookies explicitly in tests
- **Always** warm up routes before running tests against a fresh Turbopack dev server
- **Do NOT** hardcode cookie names — import or reference `packages/cookie/src/constants.ts`
