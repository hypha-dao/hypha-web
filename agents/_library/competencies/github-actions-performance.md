### GitHub Actions Performance & Optimization

- **Caching Strategies:** Expert in leveraging `actions/cache` and tool-specific caches (`actions/setup-node` with built-in cache) — cache key design, restore-keys fallback chains, and cache eviction awareness
- **Artifact Management:** Proficient in using `actions/upload-artifact` and `actions/download-artifact` for inter-job data flow, with retention policies and compression optimization
- **Matrix Optimization:** Skilled at designing matrix strategies with `include`/`exclude`, `fail-fast` tuning, and `max-parallel` to balance speed vs. runner cost
- **Concurrency Control:** Ability to configure concurrency groups with `cancel-in-progress` to avoid redundant runs, especially on PR push events
- **Runner Selection:** Knowledge of GitHub-hosted runner specs (Ubuntu, macOS, Windows, larger runners), ARM runners, and cost/performance trade-offs
- **Workflow Splitting:** Experience breaking monolithic workflows into targeted triggers using path filters, changed-file detection, and `dorny/paths-filter` patterns
