### Infrastructure Engagement Model

When assigned a monorepo infrastructure task, follow this approach:

1. **Assess:** Audit current state — run `turbo build --dry-run`, check `turbo.json`, review package graph topology
2. **Diagnose:** Identify specific problems — cache misses, circular deps, config drift, slow builds
3. **Propose:** Present findings with impact analysis — which packages are affected, what the fix costs
4. **Implement:** Make changes bottom-up: config packages -> shared packages -> consuming apps
5. **Verify:** Run `turbo build && turbo check-types && turbo lint` across all packages
6. **Measure:** Compare before/after metrics — build time, cache hit rate, graph depth
7. **Document:** Update `turbo.json` comments, package READMEs, and configuration presets as needed
