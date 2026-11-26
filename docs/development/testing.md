# Developer guide: tests

How tests are organized in this repo, how to run them, and what CI runs.

## Three kinds of tests

| Kind | Runner | Lives in | Name | Run with |
|---|---|---|---|---|
| Unit | Vitest | `src/**/__tests__/` next to the code under test | `*.test.ts` / `*.test.tsx` | `pnpm test` (CI, every PR) |
| End-to-end | Playwright | `apps/web-e2e/src/` | `*.spec.ts` | `pnpm e2e` (local, needs the app on :3000) |
| Contracts | Hardhat | `packages/storage-evm/test/` | `*.test.ts` | `npx hardhat test` in `packages/storage-evm` |

`.spec.ts` is for Playwright only. A Vitest file is always `.test.ts(x)`.

## Unit tests (Vitest)

### Where they go

Put a test in a `__tests__/` folder next to the code it tests:

```
src/space/server/get-space-members-roster.ts
src/space/server/__tests__/get-space-members-roster.test.ts
```

Every `src/**/*.test.ts(x)` file in a package runs; there are no folder lists to update.

### Writing one

- Import the API from `vitest` (`import { describe, expect, it, vi } from 'vitest'`); globals are not enabled.
- Tests run in Node. A file that needs the DOM starts with `// @vitest-environment jsdom`.
- No network, no database, no browser: mock the client (`vi.mock`) or inject the dependency. A test that needs a real service belongs in the integration tier (below).
- Import the module under test at the top of the file, not inside a test. `vi.mock` is hoisted, so mocks still apply, and a slow import is not charged to the first test's timeout. If the import needs setup first, do it once in `beforeAll`.
- Timeout is 15 s per test. A test close to that is a smell: split it or speed it up.

### Integration tier

Tests that need a real external service are excluded from `pnpm test` and named by what they need:

| Suffix | Needs | Skips itself when |
|---|---|---|
| `*.db.integration.test.ts` | a Postgres database | `BRANCH_DB_URL` and `DEFAULT_DB_URL` are unset |
| `*.browser.test.ts(x)` | a locally installed Chrome | Chrome is not found |

Run them with `pnpm test:integration` (root) or `pnpm --filter <package> test:integration`. Point database tests at a throwaway database, never production. CI does not run this tier.

### Package setup

Each package with unit tests has:

- `"test": "vitest run"` in `package.json` (plus `"test:integration": "vitest run --config vitest.integration.config.ts"` if it has integration tests);
- `@hypha-platform/config-vitest` as a dev dependency;
- a `vitest.config.ts` built on the shared config, with package-specific settings only:

```ts
import { defineUnitConfig } from '@hypha-platform/config-vitest';

export default defineUnitConfig();
```

The shared config ([`config/vitest/base.js`](../../config/vitest/base.js)) sets the Node environment, the include and exclude patterns, the child-process pool and the timeout. Turbo picks up any package with a `test` script.

### Running

```bash
pnpm test                                   # every package (turbo, cached)
pnpm --filter @hypha-platform/core test     # one package
pnpm --filter @hypha-platform/core exec vitest run src/space/server/__tests__/get-space-members-roster.test.ts
```

## CI

The `unit-tests` job in `.github/workflows/deploy-preview.yml` runs `pnpm test` on every pull request and in the merge queue, in parallel with the other checks. It gets no secrets, so no test can reach a real database or chain. It is meant to be a required check in the `main` branch ruleset, so a failing unit test blocks the merge.

Not in CI yet: the integration tier, end-to-end tests and contract tests.
