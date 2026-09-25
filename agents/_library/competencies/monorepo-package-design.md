### Monorepo Package Design

#### Workspace Structure

| Directory   | Purpose                                              | Examples                           |
| ----------- | ---------------------------------------------------- | ---------------------------------- |
| `apps/`     | Deployable applications with their own build targets | `web` (Next.js), `api`, `web-e2e`  |
| `packages/` | Shared libraries consumed by apps and other packages | `core`, `ui`, `epics`, `storage-*` |
| `config/`   | Shared configuration presets (no runtime code)       | `typescript/`, `eslint/`           |

#### Package.json Conventions

- **Scope:** All packages under `@hypha-platform/*`, all `"private": true`
- **Module type:** `"type": "module"` — ESM throughout
- **Exports map:** Explicit `"exports"` field defining public API surface
- **Scripts:** Package-level scripts (`build`, `lint`, `check-types`, `dev`) wired into Turborepo tasks

#### Export Patterns

| Pattern                           | Use Case                                | Example                                     |
| --------------------------------- | --------------------------------------- | ------------------------------------------- |
| Single `"."` export               | Simple packages with one public surface | `authentication`, `storage-postgres`        |
| Split `"./client"` / `"./server"` | Server/client boundary enforcement      | `core`, `ui`                                |
| Domain-scoped exports             | Feature-organized with nested paths     | `core/governance/server/actions`            |
| Config exports                    | CSS/utility exports alongside code      | `ui-utils` exports `"."` + `"./global.css"` |

#### Internal Package Resolution

- pnpm workspace protocol: `"@hypha-platform/core": "workspace:*"` — resolved at install time
- No publishing — all packages are `"private": true` and consumed via workspace links
- TypeScript path resolution via `tsconfig.json` references or bundler module resolution

#### Dependency Direction

```
apps/web  ->  packages/epics  ->  packages/core  ->  packages/storage-*
              packages/ui
              packages/ui-utils
```

- Dependencies flow downward: apps -> feature packages -> domain packages -> storage packages
- Never reverse the direction — `storage-postgres` must not import from `core`
- Config packages (`config/*`) are devDependencies consumed by all levels

#### Shared Configuration Hierarchy

```
config/typescript/base.json          — Strict TS defaults for all packages
  ├── config/typescript/library.json — ESNext module, bundler resolution, noEmit
  ├── config/typescript/react-library.json — Adds JSX support
  └── config/typescript/nextjs.json  — Next.js specific overrides
```

```
config/eslint/base.js               — Shared ESLint rules
  ├── config/eslint/react-internal.js — React rules for packages
  └── config/eslint/next.js          — Next.js rules for apps
```
