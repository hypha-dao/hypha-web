---
name: github-cli
description: Manage GitHub issues, PRs, releases, and workflows using the gh CLI. Use when creating PRs, reviewing code, managing issues, checking CI status, working with releases, or when the user mentions gh, pull request, PR, issue, release, GitHub Actions, or CI checks.
---

# GitHub CLI

Interact with GitHub repositories using the `gh` CLI tool. All commands assume authentication is already configured.

## Repository Context

```bash
# Always verify context before operations
gh repo view --json nameWithOwner,defaultBranchRef
```

## Pull Requests

### Create a PR

```bash
# From current branch — interactive title/body
gh pr create --fill

# With explicit fields
gh pr create --title "feat: add user dashboard" \
  --body "## Summary
- Adds dashboard component
- Integrates metrics API

## Testing
- [ ] Unit tests pass
- [ ] E2E coverage added" \
  --base main

# Draft PR
gh pr create --fill --draft

# With reviewers and labels
gh pr create --fill --reviewer user1,user2 --label "enhancement"
```

### Review PRs

```bash
# List open PRs
gh pr list

# View PR details
gh pr view 42
gh pr view 42 --json title,body,reviews,statusCheckRollup

# Check diff
gh pr diff 42

# Review actions
gh pr review 42 --approve
gh pr review 42 --request-changes --body "Needs fix: ..."
gh pr review 42 --comment --body "Looks good, minor nit: ..."

# Merge
gh pr merge 42 --squash --delete-branch
gh pr merge 42 --rebase
```

### PR Status & Checks

```bash
# CI status for current branch
gh pr checks

# CI status for specific PR
gh pr checks 42

# Watch checks until complete
gh pr checks 42 --watch

# View failed check logs
gh run view <run-id> --log-failed
```

## Issues

```bash
# List issues
gh issue list
gh issue list --label "bug" --assignee @me

# Create issue
gh issue create --title "Bug: login fails" \
  --body "Steps to reproduce..." \
  --label "bug"

# View and update
gh issue view 15
gh issue close 15 --reason completed
gh issue reopen 15
gh issue edit 15 --add-label "priority:high"
```

## GitHub Actions

```bash
# List workflow runs
gh run list
gh run list --workflow deploy-preview.yml

# View specific run
gh run view <run-id>
gh run view <run-id> --log-failed

# Re-run failed jobs
gh run rerun <run-id> --failed

# Watch a run in progress
gh run watch <run-id>

# Trigger workflow manually
gh workflow run <workflow-name> --ref <branch>
```

## Releases

```bash
# List releases
gh release list

# Create release
gh release create v1.0.0 --generate-notes
gh release create v1.0.0 --title "v1.0.0" --notes "Release notes..."

# Create draft release
gh release create v1.0.0 --draft --generate-notes

# Upload assets
gh release upload v1.0.0 ./dist/artifact.tar.gz
```

## Repository

```bash
# Clone
gh repo clone owner/repo

# Fork
gh repo fork owner/repo --clone

# View repo info
gh repo view
gh repo view --json description,latestRelease,defaultBranchRef

# Search repos
gh search repos "topic:dao language:typescript"
```

## API Access

For operations not covered by built-in commands:

```bash
# GET request
gh api repos/{owner}/{repo}/pulls/42/comments

# POST request
gh api repos/{owner}/{repo}/issues/15/comments \
  -f body="Automated comment"

# GraphQL
gh api graphql -f query='
  query {
    repository(owner: "hypha-dao", name: "hypha-web") {
      pullRequests(last: 5, states: OPEN) {
        nodes { title number }
      }
    }
  }'

# Paginate results
gh api repos/{owner}/{repo}/issues --paginate
```

## Output Formatting

```bash
# JSON output for parsing
gh pr list --json number,title,author
gh pr view 42 --json statusCheckRollup --jq '.statusCheckRollup[] | select(.conclusion == "FAILURE")'

# Table format
gh pr list --json number,title,state --template '{{tablerow "PR" "Title" "State"}}{{range .}}{{tablerow .number .title .state}}{{end}}'

# Extract specific fields
gh pr view 42 --json headRefName --jq '.headRefName'
```

## Common Patterns

### PR Workflow

1. Push branch
2. `gh pr create --fill --draft`
3. `gh pr checks --watch`
4. `gh pr ready` (when checks pass)
5. `gh pr merge --squash --delete-branch`

### Issue Triage

1. `gh issue list --label "bug" --state open`
2. `gh issue edit <num> --add-label "priority:high" --add-assignee @me`
3. Work on fix, create PR referencing issue
4. `gh pr create --title "fix: resolve #<num>"`

## Reference

- For full command reference, see [commands.md](references/commands.md)
- For project-specific workflow patterns, see [workflows.md](references/workflows.md)
