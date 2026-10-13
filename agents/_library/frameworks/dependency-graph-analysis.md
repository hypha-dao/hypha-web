### Dependency Graph Analysis Framework

#### Graph Topology Assessment

| Metric                  | Healthy Range              | Action if Exceeded                             |
| ----------------------- | -------------------------- | ---------------------------------------------- |
| **Max depth**           | 3-4 layers                 | Flatten by merging intermediate packages       |
| **Fan-out per package** | < 5 direct dependencies    | Extract shared utilities into a common package |
| **Fan-in per package**  | No hard limit, but balance | High fan-in packages need careful API design   |
| **Cycles**              | 0                          | Break immediately — blocks install and builds  |
| **Orphan packages**     | 0                          | Remove or connect to the graph                 |

#### Layer Discipline

```
Layer 0: config/*           — Shared build/lint configuration (devDependencies only)
Layer 1: storage-*          — Data access, schemas, external service clients
Layer 2: core               — Business logic, types, server actions
Layer 3: epics, ui, i18n    — Feature UI, design system, localization
Layer 4: apps/*             — Deployable applications
```

Rules:

- Dependencies flow strictly downward (higher layer -> lower layer)
- Same-layer dependencies are allowed but should be minimized
- Cross-cutting packages (e.g., `ui-utils`) sit at the lowest consumed layer
- Config packages are consumed as devDependencies at every layer

#### Dependency Change Impact Analysis

When modifying a package, assess impact using:

```bash
# Show all packages that depend on core (direct + transitive)
turbo build --filter=...@hypha-platform/core --dry-run

# Show only direct dependents
turbo build --filter=@hypha-platform/core... --dry-run
```

| Change Type    | Impact Scope                          | Required Validation               |
| -------------- | ------------------------------------- | --------------------------------- |
| Type change    | All transitive consumers              | `turbo check-types` on full graph |
| Export removal | Direct consumers only                 | `turbo build --filter=<pkg>...`   |
| New dependency | Package + all consumers (bundle size) | Review bundle impact in apps      |
| Config change  | All packages using that config preset | `turbo build` full                |

#### Common Graph Problems

| Problem                 | Symptom                                               | Fix                                           |
| ----------------------- | ----------------------------------------------------- | --------------------------------------------- |
| **Circular dependency** | `pnpm install` fails or infinite build loop           | Extract shared code to new leaf package       |
| **God package**         | One package imported everywhere, slow to build        | Split by domain into smaller focused packages |
| **Leaky abstraction**   | Consumer imports internal paths, not `exports`        | Enforce exports map, add lint rule            |
| **Phantom dependency**  | Package uses dep not in its own `package.json`        | Add explicit dependency, run `syncpack`       |
| **Version mismatch**    | Different packages use different versions of same dep | `syncpack fix-mismatches`                     |
