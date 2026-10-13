### TypeScript Monorepo Architecture

#### Stack

- **Runtime:** TypeScript 5.8 (strict mode), React 19, Node.js
- **Monorepo:** pnpm workspaces + Turborepo v2.5
- **Package scope:** `@hypha-platform/*`, all private, `"type": "module"`

#### Package Dependency Graph

```
apps/web (Next.js 15)  ->  @hypha-platform/epics  ->  @hypha-platform/core  ->  @hypha-platform/storage-postgres
                            @hypha-platform/ui                                    @hypha-platform/storage-evm
                            @hypha-platform/ui-utils
```

#### Key Packages

| Package            | Purpose                                        | Export Pattern                                        |
| ------------------ | ---------------------------------------------- | ----------------------------------------------------- |
| `core`             | Business logic, types, server actions          | `./client`, `./server`, `./governance/server/actions` |
| `epics`            | Feature-level UI components + hooks            | Single `"."` export, domain-organized                 |
| `ui`               | Design system (shadcn/ui primitives)           | `"."` (client), `"./server"` (RSC)                    |
| `ui-utils`         | Tailwind utilities, `cn()` helper              | `"."`, `"./global.css"`                               |
| `storage-postgres` | Drizzle ORM schemas, migrations, DB connection | Single `"."` export                                   |
| `storage-evm`      | Solidity contracts, Hardhat config, ABIs       | Contracts only                                        |
| `authentication`   | Privy auth provider + `useAuthentication` hook | Single `"."` export                                   |
| `i18n`             | en/de dictionaries, middleware, routing        | `"."`, `"./client"`                                   |

#### Conventions

- Server code uses `'use server'` directive, client code uses `'use client'`
- Explicit `./client` and `./server` package exports prevent bundle leaks
- `DatabaseInstance` is passed as config parameter (`{ db }`) — never imported directly in queries
- Shared types (`PaginatedResponse<T>`, `PaginationParams`) defined in `core/common`
