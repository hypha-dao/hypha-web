### Turborepo Pipeline Architecture

#### Task Graph (turbo.json)

Turborepo's `turbo.json` defines a directed acyclic graph (DAG) of tasks. Each task declares its dependencies, inputs, outputs, and environment variables.

| Field        | Purpose                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `dependsOn`  | Task dependencies — `^build` means "run `build` in all dependencies first"                           |
| `inputs`     | Files that affect cache key — `$TURBO_DEFAULT$` plus explicit globs and `.env*`                      |
| `outputs`    | Build artifacts to cache — e.g., `.next/**`, `dist/**`                                               |
| `env`        | Environment variables included in cache hash — list only what varies between environments            |
| `cache`      | Whether to cache the task — `false` for non-deterministic tasks like `dev`, `migrate`, `generate`    |
| `persistent` | Long-running tasks (dev servers, watchers) that don't exit — prevents downstream tasks from starting |

#### Task Types

| Type         | Example Tasks                | Caching | `dependsOn`              |
| ------------ | ---------------------------- | ------- | ------------------------ |
| **Build**    | `build`, `check-types`       | Yes     | `^build`, `^check-types` |
| **Lint**     | `lint`                       | Yes     | `^lint`                  |
| **Dev**      | `dev`                        | No      | —                        |
| **Generate** | `generate`, `wagmi:generate` | No      | `^wagmi:generate`        |
| **Migrate**  | `migrate`                    | No      | —                        |

#### Topological Ordering

Turborepo resolves the package dependency graph and runs tasks in topological order:

1. Leaf packages with no internal dependencies run first
2. Packages whose dependencies have completed run next
3. Maximum parallelism is achieved automatically within each topological level
4. `^` prefix in `dependsOn` means "run this task in all workspace dependencies first"

#### Cache Key Composition

A task's cache key is computed from:

- Source file hashes (filtered by `inputs`)
- Environment variable values (filtered by `env`)
- `turbo.json` configuration hash
- Resolved dependency versions
- Task `dependsOn` outputs (transitive)

#### Remote Cache

- Vercel Remote Cache enables shared cache across CI runs and developer machines
- Cache artifacts are content-addressed and immutable
- Environment variable filtering (`env` in `turbo.json`) prevents cache poisoning from unrelated env changes
- Team-scoped cache prevents cross-project pollution
