### Testing Best Practices

#### Do

- Write E2E tests for critical user flows: space creation, proposal voting, member joining
- Use Page Object Model for Playwright tests — isolate selectors from test logic
- Use `loadFixture` in Hardhat tests — every test gets a clean contract state
- Test happy path AND failure cases for server actions and mutations
- Validate Zod schemas reject malformed inputs
- Test full-text search with representative queries (titles, partial matches)
- Run `turbo build` as a type-level integration test before submitting PRs

#### Avoid

- Testing implementation details — test behavior and outcomes
- Sharing mutable state between tests — each test should be independent
- Skipping contract event assertions — events are the API for off-chain consumers
- Writing E2E tests for pure logic — use unit tests instead
- Ignoring flaky tests — fix or quarantine immediately
- Testing third-party library behavior (Privy, Drizzle internals)
