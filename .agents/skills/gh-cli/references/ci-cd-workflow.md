# CI/CD Workflow

```bash
# Run workflow
gh workflow run ci.yml --ref main

# Resolve latest run ID for this workflow/branch
RUN_ID=$(gh run list \
  --workflow ci.yml \
  --branch main \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId')

# Watch the run
gh run watch "$RUN_ID"

# Download artifacts on completion
gh run download "$RUN_ID" --dir ./artifacts
```
