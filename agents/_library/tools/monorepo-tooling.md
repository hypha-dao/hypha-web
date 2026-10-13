### Monorepo Tooling

#### Build Orchestration

| Tool                | Usage                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| `turbo`             | Task orchestration — `turbo build`, `turbo dev`, `turbo lint`, `turbo check-types` |
| `turbo --filter`    | Scoped execution — `--filter=@hypha-platform/core...` (package + dependents)       |
| `turbo --dry-run`   | Task graph preview — verify topology without executing                             |
| `turbo --graph`     | Visual dependency graph output (DOT format, pipe to Graphviz)                      |
| `turbo --summarize` | Post-execution report — cache hits/misses, timing per task                         |

#### Package Management

| Tool                  | Usage                                                                           |
| --------------------- | ------------------------------------------------------------------------------- |
| `pnpm install`        | Install all workspace dependencies with strict hoisting                         |
| `pnpm --filter <pkg>` | Run commands in a specific package — `pnpm --filter @hypha-platform/core build` |
| `pnpm add -w`         | Add dependency to workspace root (shared dev tools)                             |
| `pnpm add --filter`   | Add dependency to specific package                                              |
| `pnpm outdated -r`    | Check for outdated dependencies across all workspaces                           |
| `pnpm audit`          | Security vulnerability scan across all packages                                 |

#### Dependency Consistency

| Tool                       | Usage                                                  |
| -------------------------- | ------------------------------------------------------ |
| `syncpack list-mismatches` | Find version inconsistencies across workspace packages |
| `syncpack fix-mismatches`  | Auto-fix version inconsistencies to highest semver     |
| `syncpack list`            | Show all dependency versions across the monorepo       |

#### Type Checking & Linting

| Tool                | Usage                                                         |
| ------------------- | ------------------------------------------------------------- |
| `turbo check-types` | Run `tsc --noEmit` across all packages in dependency order    |
| `turbo lint`        | Run ESLint across all packages                                |
| `prettier --check`  | Format verification — `prettier --check 'apps/**/*.{ts,tsx}'` |
| `prettier --write`  | Auto-format — `prettier --write 'packages/**/*.{ts,tsx}'`     |

#### CI/CD Integration

- **GitHub Actions:** Use `turbo` with remote cache for fast CI builds
- **Vercel:** Automatic preview deployments per PR with `vercel build`
- **Neon:** Database branch per PR for isolated preview environments
- **Cache:** Vercel Remote Cache or self-hosted cache via `turbo login` + `turbo link`
