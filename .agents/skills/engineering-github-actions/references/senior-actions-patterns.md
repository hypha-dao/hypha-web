## Senior GitHub Actions patterns

### 1) Concurrency control (default for PR workflows)

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Use to prevent obsolete runs from consuming CI minutes.

### 2) Least-privilege permissions

Set workflow-level permissions to minimal defaults, then elevate at job level only when required.

```yaml
permissions:
  contents: read
```

### 3) Deterministic dependency install

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm
- uses: pnpm/action-setup@v4
- run: pnpm install --frozen-lockfile
```

### 4) Targeted execution

- Narrow triggers with `paths` / `paths-ignore`.
- Gate heavy jobs with `if:` conditions based on changed files or upstream outputs.

### 5) Reusable workflows for shared logic

Create reusable workflows with `on: workflow_call` when logic is duplicated across pipelines.

### 6) Performance review checklist

- Are duplicate installs/builds happening in multiple jobs?
- Are unnecessary matrix dimensions inflating runtime?
- Are caches keyed on lockfiles and tool versions?
- Are long-running jobs skipped for unaffected changes?
- Are there flaky network/setup steps without retry strategy?

### 7) Safe change strategy

- Keep required checks stable when editing workflow names/job names.
- Introduce changes incrementally.
- Document rollback path (revert commit or toggle condition/feature flag).
