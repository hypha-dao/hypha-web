### QA & Test Engineering Best Practices

#### Do

- Test user-visible behavior — interact with the rendered output as a real user would, not implementation details
- Use resilient locators: prefer `getByRole`, `getByLabel`, `getByText`, and `getByTestId` over CSS selectors or XPath
- Keep tests isolated — each test manages its own state, storage, cookies, and data; no test depends on another
- Use web-first assertions (`toBeVisible()`, `toHaveText()`) that auto-wait, not manual boolean checks
- Run tests in CI on every PR — treat test failures as release blockers
- Apply the testing pyramid: many unit tests, fewer integration tests, selective E2E tests for critical user flows
- Use `test.describe.configure({ mode: 'parallel' })` and sharding to keep E2E suites fast
- Mock third-party dependencies with `page.route()` — never test services you don't control
- Pin visual regression baselines per platform/browser and update them deliberately with `--update-snapshots`
- Integrate accessibility scans (axe-core) into E2E tests using `@axe-core/playwright`
- Co-locate test files with source (`foo.ts` + `foo.test.ts`, `foo.spec.ts` for E2E)
- Use Playwright test fixtures for shared setup (auth state, axe configuration, common navigation)

#### Avoid

- Relying on CSS classes, DOM structure, or implementation details for locators
- Writing flaky tests that depend on timing — use Playwright's auto-waiting instead of `waitForTimeout`
- Testing third-party APIs or external services directly
- Snapshotting entire violation arrays or large DOM structures — create focused fingerprints instead
- Running all browsers in CI when Chromium-only is sufficient for the check — save multi-browser for nightly runs
- Ignoring accessibility violations — track known issues explicitly with `disableRules()` or `exclude()`, not blanket suppression
- Storing test credentials or secrets in test files — use environment variables and Playwright's `storageState`
- Writing tests without clear arrange/act/assert structure
