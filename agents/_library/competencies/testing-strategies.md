### Testing Strategies

#### Testing Layers

| Layer              | Tool           | Package                         | Scope                                      |
| ------------------ | -------------- | ------------------------------- | ------------------------------------------ |
| **E2E**            | Playwright     | `apps/web-e2e`                  | Full user flows through the Next.js app    |
| **Smart Contract** | Hardhat + Chai | `packages/storage-evm/test`     | On-chain logic, events, access control     |
| **Unit**           | Vitest         | `packages/*`                    | Pure functions, utilities, transformations |
| **Visual**         | Storybook      | `packages/epics`, `packages/ui` | Component rendering, states, variants      |

#### E2E Patterns

- **Page Object Model:** `BasePage` class with `waitForPageLoad()`, extended per page
- **Composition:** Pages compose section objects (e.g., `MySpaces` has `MemberSpaces` + `RecommendedSpaces`)
- **Location:** `apps/web-e2e/src/` with `pages/` for page objects, root for specs

#### Smart Contract Test Patterns

- **Fixture-based:** `loadFixture(deployFixture)` for test isolation and performance
- **Helper classes:** `SpaceHelper` wraps contract interactions for readable tests
- **Event assertions:** `expect(tx).to.emit(contract, 'EventName').withArgs(...)`
- **UUPS deployment:** `upgrades.deployProxy(Factory, [args], { initializer: 'initialize', kind: 'uups' })`

#### Unit Test Patterns

- Co-located with source: `foo.ts` + `foo.test.ts`
- Vitest for fast execution with ESM support
- Focus on: query builders, type transformations, utility functions, Zod schemas
