### Build Performance Optimization

#### Cache Effectiveness

| Strategy                       | Impact                                                               |
| ------------------------------ | -------------------------------------------------------------------- |
| **Precise `inputs` filtering** | Exclude non-source files (docs, tests) from cache keys               |
| **Minimal `env` declarations** | Only list env vars that genuinely affect build output                |
| **Output declarations**        | Declare `outputs` so Turborepo can restore cached artifacts          |
| **Remote cache**               | Share cache between CI runs and developers — avoids redundant builds |
| **Granular packages**          | Smaller packages = more cache hits when only one area changes        |

#### Build Parallelism

- Turborepo automatically parallelizes tasks within the same topological level
- Leaf packages (no internal deps) always run first and in parallel
- `persistent: true` tasks block topological dependents — use only for dev servers
- CPU-bound tasks benefit from `--concurrency` tuning (default: 10 or CPU count)

#### Incremental Build Strategies

| Strategy                     | Tool                | Benefit                                      |
| ---------------------------- | ------------------- | -------------------------------------------- |
| **Task-level caching**       | Turborepo           | Skip unchanged packages entirely             |
| **TypeScript incremental**   | `tsc --incremental` | Reuse `.tsbuildinfo` for faster type checks  |
| **Turbopack (dev)**          | Next.js + Turbopack | Fast HMR via Rust-based bundler              |
| **Selective task execution** | `turbo --filter`    | Run tasks only for changed packages and deps |

#### Filter Patterns

```bash
turbo build --filter=@hypha-platform/core       # Single package
turbo build --filter=@hypha-platform/core...     # Package + all dependents
turbo build --filter=...@hypha-platform/core     # Package + all dependencies
turbo build --filter='...[HEAD~1]'               # Only packages changed since last commit
turbo build --filter='./packages/*'              # All packages in directory
```

#### Performance Diagnostics

| Command / Flag              | Purpose                                                |
| --------------------------- | ------------------------------------------------------ |
| `turbo build --dry-run`     | Show task graph without executing — verify topology    |
| `turbo build --graph`       | Generate visual dependency graph (DOT format)          |
| `turbo build --summarize`   | Post-build report: cache hits, misses, timing per task |
| `turbo build --verbosity=2` | Detailed logging including cache key computation       |
| `TURBO_LOG_VERBOSITY=debug` | Environment-based verbose logging for CI debugging     |

#### Anti-Patterns

- Listing `*` in `env` — invalidates cache on any environment change
- Missing `outputs` — forces re-execution even when artifacts exist
- Overly large packages — one file change invalidates the entire package cache
- `cache: false` on deterministic tasks — wastes CI minutes
- Circular workspace dependencies — breaks topological sort, fails install
