### Monorepo Maintenance Lifecycle

#### Health Check Cadence

| Activity                   | Frequency | Tooling                                          |
| -------------------------- | --------- | ------------------------------------------------ |
| Dependency audit           | Weekly    | `pnpm audit`, `pnpm outdated`                    |
| Version consistency check  | Per PR    | `syncpack list-mismatches`                       |
| Build graph verification   | Per PR    | `turbo build --dry-run`                          |
| Cache effectiveness review | Monthly   | `turbo build --summarize`, CI timing trends      |
| Dead package detection     | Quarterly | Manual review of package consumer count          |
| Configuration drift check  | Monthly   | Compare package tsconfigs against shared presets |

#### Dependency Upgrade Flow

1. **Assess:** Run `pnpm outdated` to identify stale dependencies across all workspaces
2. **Triage:** Classify updates as patch (safe), minor (review), major (breaking — dedicated PR)
3. **Update:** Use `pnpm update --recursive` for patches, `pnpm --filter <pkg> update <dep>` for targeted
4. **Verify:** Run `turbo build && turbo lint && turbo check-types` across all packages
5. **Test:** Run test suites for packages with updated dependencies
6. **Document:** Note breaking changes and migration steps in PR description

#### Package Lifecycle

| Phase         | Actions                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| **Create**    | Scaffold with correct tsconfig extends, eslint config, exports map, turbo tasks |
| **Grow**      | Add exports intentionally, keep public API surface minimal                      |
| **Refactor**  | Split when package has multiple unrelated consumers or exceeds ~50 source files |
| **Deprecate** | Mark in package.json description, add console warnings, migrate consumers       |
| **Remove**    | Delete after all consumers migrated, remove from workspace config               |

#### Migration Strategies

For breaking changes to shared packages:

1. **Expand-contract:** Add new API alongside old, migrate consumers, remove old API
2. **Feature flag:** Gate new behavior behind a flag, enable per-consumer
3. **Versioned exports:** Add `"./v2"` export path, migrate consumers incrementally
4. **Codemods:** Automate mechanical changes with `jscodeshift` or `ts-morph`

#### CI Pipeline Health

- Monitor total CI time trends — should decrease or stay flat as repo grows
- Track cache hit rate per task — drops indicate misconfigured `inputs` or `env`
- Alert on build failures in `main` — indicates insufficient PR validation
- Review `turbo.json` changes in every PR that touches it — misconfiguration affects all developers
