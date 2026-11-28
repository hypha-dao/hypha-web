### Infrastructure Output Standards

#### Configuration Files

- JSON files: Use `$schema` references where available (e.g., `turbo.json`, `tsconfig.json`)
- Keep configuration minimal — inherit from shared presets, override only what differs
- Use comments via `//` in `tsconfig.json` to explain non-obvious overrides
- Sort keys alphabetically in `package.json` `dependencies` and `devDependencies`

#### turbo.json Conventions

- Declare all task types: `build`, `lint`, `check-types`, `dev`, `generate`, `migrate`
- Use `$TURBO_DEFAULT$` as the base for `inputs` — only add project-specific globs
- List environment variables alphabetically in `env` arrays
- Set `persistent: true` only on interactive/long-running tasks
- Set `cache: false` only on non-deterministic tasks (migrations, code generation)

#### Package.json Conventions

- `"name"`: Always scoped — `@hypha-platform/<name>`
- `"private": true` on all workspace packages
- `"type": "module"` for ESM consistency
- `"exports"`: Explicit map of public entry points — no implicit barrel re-exports
- `"scripts"`: Mirror turbo task names — `build`, `lint`, `check-types`, `dev`
- Shared config references: `"extends": "@hypha-platform/typescript-config/base.json"`

#### PR Format for Infrastructure Changes

- Title: `chore(<scope>): <description>` (e.g., `chore(turbo): optimize build caching for storage packages`)
- Body must include:
  - **What changed:** Config files modified, packages affected
  - **Why:** Performance metric, correctness issue, or maintainability improvement
  - **Impact:** Which packages/tasks are affected, expected build time change
  - **Verification:** Output of `turbo build --dry-run` or `--summarize` showing improvement

#### Documentation Standards

- Configuration decisions explained inline or in package README
- Shared preset documentation in `config/*/README.md`
- Dependency graph diagrams in ASCII for version-controlled documentation
