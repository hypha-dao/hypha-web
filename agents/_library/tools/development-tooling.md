### Development Tooling

#### Build & Package Management

| Tool          | Usage                                                                                 |
| ------------- | ------------------------------------------------------------------------------------- |
| `pnpm`        | Package manager — `pnpm install`, `pnpm add -w`, `pnpm --filter <pkg>`                |
| `turbo`       | Build orchestration — `turbo build`, `turbo dev`, `turbo lint`                        |
| `drizzle-kit` | Schema migrations — `drizzle-kit generate`, `drizzle-kit migrate`, `drizzle-kit push` |
| `vercel`      | Deployment — `vercel build`, `vercel deploy`, `vercel pull`                           |
| `hardhat`     | Smart contracts — `npx hardhat compile`, `npx hardhat test`                           |

#### Development Servers

- `pnpm dev` — Starts Next.js with Turbopack on the web app
- `pnpm storybook` — Component development and visual testing
- Neon DB branches for isolated preview environments per PR

#### Code Quality

- Prettier for formatting (`prettier --check`)
- ESLint with shared config (`@hypha-platform/eslint-config`)
- TypeScript strict mode across all packages
- `turbo build` as the integration gate — catches cross-package type errors
