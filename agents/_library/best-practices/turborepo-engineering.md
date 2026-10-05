### Turborepo Engineering Best Practices

#### Do

- Declare explicit `inputs` and `outputs` for every cacheable task in `turbo.json`
- List only environment variables that affect build output in `env` — never use `"*"` on cacheable tasks
- Use `^` prefix in `dependsOn` to enforce topological ordering across workspace packages
- Keep packages small and focused — one domain concern per package maximizes cache granularity
- Use `workspace:*` protocol for all internal dependencies — never pin specific versions
- Maintain shared configuration in `config/*` packages — tsconfig presets, eslint configs
- Run `turbo build --dry-run` to verify task graph before CI changes
- Use `--filter` in development to avoid rebuilding the entire monorepo
- Set `persistent: true` only on long-running tasks (`dev`, `start`) — never on build tasks
- Pin `packageManager` field in root `package.json` to ensure consistent pnpm version
- Use `globalDependencies` for files that affect all packages (`.env`, root config)

#### Avoid

- Hoisting runtime dependencies to root `package.json` — keeps dependency resolution explicit per package
- Circular dependencies between workspace packages — breaks topological sort and install
- Importing from package internals (bypassing `exports` map) — creates fragile implicit contracts
- Using `cache: false` on deterministic tasks — wastes CI compute on every run
- Sharing `node_modules` state between tasks — rely on Turborepo's declared inputs/outputs
- Putting large generated files in `inputs` — bloats cache keys and slows hashing
- Mixing `devDependencies` and `dependencies` incorrectly — config packages should be `devDependencies`
- Creating packages with no clear consumers — every package should have at least one `apps/*` consumer
- Using `tsc` for building libraries when bundler resolution suffices — prefer `noEmit: true` with bundler
- Ignoring `turbo build --summarize` output — cache miss patterns reveal configuration problems
