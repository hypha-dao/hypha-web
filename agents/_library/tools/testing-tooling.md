### Testing Tooling

#### Test Runners

| Tool           | Usage                    | Command                                        |
| -------------- | ------------------------ | ---------------------------------------------- |
| **Playwright** | E2E browser testing      | `pnpm --filter web-e2e test`                   |
| **Hardhat**    | Smart contract testing   | `npx hardhat test` (in `packages/storage-evm`) |
| **Vitest**     | Unit testing             | `pnpm --filter <pkg> test`                     |
| **Storybook**  | Visual component testing | `pnpm storybook`                               |

#### Test Infrastructure

- **Neon DB branches:** CI creates `test/pr-{number}-{branch}` branches for isolated test databases
- **Hardhat network:** In-memory EVM for contract tests — no external dependency
- **Playwright config:** Located in `apps/web-e2e/`, runs against preview deployments in CI

#### Debugging

- Playwright: `--debug` flag for step-through, `--trace on` for trace viewer
- Hardhat: `console.log` in Solidity contracts, `hardhat console` for REPL
- Vitest: `--reporter=verbose` for detailed output, `--watch` for development
