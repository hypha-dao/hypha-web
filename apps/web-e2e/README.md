# Hypha Web E2E Testing

End-to-end testing for the Hypha web application using Playwright.

## Overview

This E2E testing setup provides:

- **Privy Test Mode Support**: Bypass OAuth authentication for faster, more reliable tests
- **Page Object Model (POM)**: Organized, maintainable test code
- **Multiple Test Projects**: Authenticated, unauthenticated, and cross-browser testing
- **Component Objects**: Reusable UI component abstractions

## Quick Start

### Run All Tests

```bash
# From workspace root
npx nx e2e web-e2e

# Or with UI mode
npx nx e2e web-e2e -- --ui
```

### Run Specific Test Projects

```bash
# Run only authenticated tests
npx nx e2e web-e2e -- --project=authenticated

# Run only unauthenticated tests
npx nx e2e web-e2e -- --project=unauthenticated

# Run on specific browser
npx nx e2e web-e2e -- --project=chromium
```

### Run Specific Test Files

```bash
# Run voting tests
npx nx e2e web-e2e -- src/specs/proposals/voting.auth.spec.ts

# Run space tests
npx nx e2e web-e2e -- src/specs/spaces/
```

## Project Structure

```
apps/web-e2e/
├── src/
│   ├── components/           # Component objects (UI component abstractions)
│   │   ├── voting-form.component.ts
│   │   ├── proposal-card.component.ts
│   │   ├── login-modal.component.ts
│   │   └── ...
│   │
│   ├── pages/                # Page objects (full page abstractions)
│   │   ├── base.page.ts
│   │   ├── space-detail.page.ts
│   │   ├── proposal-detail.page.ts
│   │   ├── create-proposal.page.ts
│   │   └── ...
│   │
│   ├── fixtures/             # Test fixtures
│   │   ├── auth.fixture.ts   # Privy authentication fixture
│   │   └── index.ts
│   │
│   ├── specs/                # Test specifications
│   │   ├── auth/
│   │   │   └── auth.setup.ts
│   │   ├── proposals/
│   │   │   ├── voting.auth.spec.ts
│   │   │   └── create-proposal.auth.spec.ts
│   │   └── spaces/
│   │       ├── spaces.unauth.spec.ts
│   │       └── space-detail.spec.ts
│   │
│   └── utils/                # Utility helpers
│       ├── selectors.ts      # Test ID constants
│       └── wait-helpers.ts   # Custom wait functions
│
├── .auth/                    # Saved authentication states (gitignored)
├── playwright.config.ts      # Playwright configuration
└── README.md
```

## Authentication

### Privy Test Mode

Tests use a custom authentication fixture that injects mock Privy state into localStorage, bypassing the actual OAuth flow.

```typescript
import { test, expect } from '../../fixtures';

test('authenticated test', async ({ page, authenticateAs }) => {
  // Authenticate as a member user
  await authenticateAs('member');

  // Now the page will behave as if user is logged in
  await page.goto('/en/my-spaces');
});
```

### Available Test Users

- `member`: Regular authenticated user (space member)
- `admin`: Space admin user
- `guest`: Authenticated but non-member user

### Using Storage State (Alternative)

For scenarios requiring real authentication:

1. Run the app locally
2. Log in manually
3. Export browser state:

```typescript
import { saveAuthState } from '../fixtures';

// In a setup test
await saveAuthState(context, 'my-user.json');
```

4. Use in tests:

```typescript
test.use({ storageState: '.auth/my-user.json' });
```

## Test Naming Conventions

| Pattern            | Description                    | Project                   |
| ------------------ | ------------------------------ | ------------------------- |
| `*.auth.spec.ts`   | Tests requiring authentication | `authenticated`           |
| `*.unauth.spec.ts` | Tests for logged-out users     | `unauthenticated`         |
| `*.spec.ts`        | General tests                  | `chromium/firefox/webkit` |
| `*.setup.ts`       | Setup scripts                  | `setup`                   |

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '../../fixtures';
import { SpaceDetailPage } from '../../pages';

test.describe('Space Details', () => {
  test.beforeEach(async ({ authenticateAs }) => {
    await authenticateAs('member');
  });

  test('can view space information', async ({ page, testSpace }) => {
    const spacePage = new SpaceDetailPage(page);

    await spacePage.open(testSpace.slug);
    await spacePage.waitForSpaceLoad();

    const info = await spacePage.getSpaceInfo();
    expect(info.title).toBeTruthy();
  });
});
```

### Using Page Objects

```typescript
import { ProposalDetailPage } from '../../pages';

const proposalPage = new ProposalDetailPage(page);
await proposalPage.open('hypha', 'my-proposal-slug');
await proposalPage.voteYes();
```

### Using Component Objects

```typescript
import { VotingForm, ProposalCardList } from '../../components';

// Interact with voting form
const votingForm = new VotingForm(page);
await votingForm.voteYes();
const myVote = await votingForm.getMyVote();

// Work with proposal cards
const cards = new ProposalCardList(page);
const firstCard = cards.getCard(0);
await firstCard.click();
```

## Configuration

### Test Space Configuration

Update the test space in `fixtures/auth.fixture.ts`:

```typescript
testSpace: [
  {
    slug: 'your-test-space',      // Your test space slug
    web3SpaceId: 123,             // Your test space web3 ID
    name: 'Your Test Space',
  },
  { option: true },
],
```

### Environment Variables

| Variable   | Description               | Default                 |
| ---------- | ------------------------- | ----------------------- |
| `BASE_URL` | App URL for testing       | `http://127.0.0.1:3000` |
| `CI`       | Running in CI environment | -                       |

## Debugging

### Run with UI Mode

```bash
npx nx e2e web-e2e -- --ui
```

### View Test Report

```bash
npx playwright show-report apps/web-e2e/playwright-report
```

### Debug a Single Test

```bash
npx nx e2e web-e2e -- --debug src/specs/proposals/voting.auth.spec.ts
```

### View Traces

When tests fail, traces are saved automatically. View them:

```bash
npx playwright show-trace apps/web-e2e/test-results/path-to-trace.zip
```

## Adding Test IDs

When adding new components, include `data-testid` attributes:

```tsx
<Button data-testid="vote-yes-button" onClick={handleVote}>
  Vote Yes
</Button>
```

See `src/utils/selectors.ts` for the complete list of test IDs.

## CI Integration

The tests are configured to run in CI with:

- Retries (2 attempts)
- GitHub reporter
- HTML report generation
- Screenshot/video on failure

```yaml
# Example GitHub Action step
- name: Run E2E tests
  run: npx nx e2e web-e2e
  env:
    BASE_URL: ${{ env.STAGING_URL }}
```

---

## Production Testing

### ⚠️ Warning

Production tests run against **live https://app.hypha.earth** and can **create real data**!

### Running Public Smoke Tests (Safe)

These tests only read data and verify the site is working:

```bash
# Safe - no authentication, no data creation
npx nx e2e-production-public web-e2e
```

### Running Authenticated Tests (Creates Data!)

**Step 1: Save your login state (one-time setup)**

```bash
# Opens a browser - you must log in manually
npx nx e2e-production-auth web-e2e
```

This opens a browser where you:

1. Click "Sign in"
2. Complete Privy login
3. Wait for profile avatar to appear
4. The script auto-saves your auth state

**Step 2: Run authenticated tests**

```bash
# Run all production tests
npx nx e2e-production web-e2e

# Run specific test (create space)
npx playwright test --config=apps/web-e2e/playwright.production.config.ts create-space
```

### Production Test Files

| File                         | Purpose            | Creates Data? |
| ---------------------------- | ------------------ | ------------- |
| `smoke-tests.public.spec.ts` | Verify site is up  | ❌ No         |
| `create-space.prod.spec.ts`  | Create real spaces | ⚠️ **Yes**    |
| `production-auth.setup.ts`   | Save login state   | ❌ No         |

### Test Results

Production test artifacts are saved to:

- Screenshots: `test-results-production/`
- Report: `playwright-report-production/`
- Videos: `test-results-production/`

---

## Troubleshooting

### Tests timing out

1. Increase timeout in `playwright.config.ts`
2. Check if the dev server is starting correctly
3. Verify BASE_URL is accessible

### Authentication not working

1. Ensure Privy test mode values match your app configuration
2. Check localStorage is being set correctly
3. Verify the auth fixture is being applied

### Flaky tests

1. Add explicit waits for dynamic content
2. Use `waitForLoadState('networkidle')`
3. Check for race conditions in data loading
