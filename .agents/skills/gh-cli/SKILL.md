---
name: gh-cli
description: GitHub CLI (gh) comprehensive reference for repositories, issues, pull requests, Actions, projects, releases, gists, codespaces, organizations, extensions, and all GitHub operations from the command line.
---

# GitHub CLI (gh)

Comprehensive reference for GitHub CLI (gh) - work seamlessly with GitHub from the command line.

**Mandatory:** Load references only when required for the task at hand. Do not load references preemptively. Use the routing table below to find the relevant reference; load it only when the user's request matches that section.

**Version:** 2.85.0 (current as of January 2026)

## Preflight Check

Before using gh commands, run:

```bash
gh auth status
```

**Preflight fails when:** `gh` is not installed, `gh auth status` returns an error (not logged in), or git credential helper is not configured.

**If preflight fails:** Load [Prerequisites](./references/prerequisites.md) (installation, authentication, setup-git).

## CLI Structure

[When navigating the gh command hierarchy](./references/cli-structure.md)

## Configuration

### Global Configuration

[When listing, getting, or setting gh config values](./references/global-configuration.md)

### Environment Variables

[When using GH_TOKEN, GH_HOST, or other gh environment variables](./references/environment-variables.md)

## Authentication (gh auth)

### Login

[When logging in interactively, with token, or web auth](./references/auth-login.md)

### Status

[When checking authentication status across hosts](./references/auth-status.md)

### Switch Accounts

[When switching between GitHub accounts](./references/auth-switch.md)

### Token

[When retrieving the active auth token](./references/auth-token.md)

### Refresh

[When refreshing credentials or adding/removing scopes](./references/auth-refresh.md)

### Setup Git

[When configuring git credential helper for gh](./references/auth-setup-git.md)

## Browse (gh browse)

[When opening repo, issue, PR, or commit in browser](./references/browse.md)

## Repositories (gh repo)

### Create Repository

[When creating a new repository (public, private, org)](./references/create-repository.md)

### Clone Repository

[When cloning a repository to local](./references/clone-repository.md)

### List Repositories

[When listing repos with filters, JSON, or jq](./references/list-repositories.md)

### View Repository

[When viewing repo details or metadata](./references/view-repository.md)

### Edit Repository

[When editing description, visibility, or features](./references/edit-repository.md)

### Delete Repository

[When deleting a repository](./references/delete-repository.md)

### Fork Repository

[When forking a repo to your account or org](./references/fork-repository.md)

### Sync Fork

[When syncing a fork with upstream](./references/sync-fork.md)

### Set Default Repository

[When setting or unsetting the default repo for current directory](./references/set-default-repository.md)

### Repository Autolinks

[When managing autolinks (e.g. JIRA-123 → URL)](./references/repository-autolinks.md)

### Repository Deploy Keys

[When listing, adding, or deleting deploy keys](./references/repository-deploy-keys.md)

### Gitignore and License

[When viewing gitignore or license templates](./references/gitignore-and-license.md)

## Issues (gh issue)

### Create Issue

[When creating an issue with title, body, labels, assignees](./references/create-issue.md)

### List Issues

[When listing issues with filters, search, or JSON](./references/list-issues.md)

### View Issue

[When viewing issue details or comments](./references/view-issue.md)

### Edit Issue

[When editing title, body, labels, assignees, milestone](./references/edit-issue.md)

### Close/Reopen Issue

[When closing or reopening an issue](./references/close-reopen-issue.md)

### Comment on Issue

[When adding, editing, or deleting issue comments](./references/comment-on-issue.md)

### Issue Status

[When viewing issue status summary](./references/issue-status.md)

### Pin/Unpin Issues

[When pinning or unpinning issues to repo dashboard](./references/pin-unpin-issues.md)

### Lock/Unlock Issue

[When locking or unlocking issue conversation](./references/lock-unlock-issue.md)

### Transfer Issue

[When transferring an issue to another repo](./references/transfer-issue.md)

### Delete Issue

[When deleting an issue](./references/delete-issue.md)

### Develop Issue (Draft PR)

[When creating a draft PR from an issue](./references/develop-issue.md)

## Pull Requests (gh pr)

### Create Pull Request

[When creating a PR with title, body, reviewers, labels](./references/create-pull-request.md)

### List Pull Requests

[When listing PRs with filters, search, or JSON](./references/list-pull-requests.md)

### View Pull Request

[When viewing PR details, diff, or comments](./references/view-pull-request.md)

### Checkout Pull Request

[When checking out a PR branch locally](./references/checkout-pull-request.md)

### Diff Pull Request

[When viewing PR diff or exporting patch](./references/diff-pull-request.md)

### Merge Pull Request

[When merging a PR (merge, squash, rebase)](./references/merge-pull-request.md)

### Close Pull Request

[When closing a PR without merging](./references/close-pull-request.md)

### Reopen Pull Request

[When reopening a closed PR](./references/reopen-pull-request.md)

### Edit Pull Request

[When editing PR title, body, labels, reviewers](./references/edit-pull-request.md)

### Ready for Review

[When marking a draft PR as ready](./references/ready-for-review.md)

### Pull Request Checks

[When viewing or watching PR check status](./references/pull-request-checks.md)

### Comment on Pull Request

[When adding, editing, or deleting PR comments](./references/comment-on-pull-request.md)

### Review Pull Request

[When approving, requesting changes, or commenting on a PR](./references/review-pull-request.md)

### Update Branch

[When updating PR branch with latest base](./references/update-branch.md)

### Lock/Unlock Pull Request

[When locking or unlocking PR conversation](./references/lock-unlock-pull-request.md)

### Revert Pull Request

[When reverting a merged PR](./references/revert-pull-request.md)

### Pull Request Status

[When viewing PR status summary](./references/pull-request-status.md)

## GitHub Actions

### Workflow Runs (gh run)

[When listing, viewing, rerunning, or downloading run artifacts](./references/workflow-runs.md)

### Workflows (gh workflow)

[When listing, enabling, disabling, or running workflows](./references/workflows.md)

### Action Caches (gh cache)

[When listing or deleting Actions caches](./references/action-caches.md)

### Action Secrets (gh secret)

[When managing repository or org secrets](./references/action-secrets.md)

### Action Variables (gh variable)

[When managing repository or org variables](./references/action-variables.md)

## Projects (gh project)

[When managing projects, fields, items, links](./references/projects.md)

## Releases (gh release)

[When creating, viewing, uploading, or downloading releases](./references/releases.md)

## Gists (gh gist)

[When listing, creating, editing, or cloning gists](./references/gists.md)

## Codespaces (gh codespace)

[When creating, SSHing, or managing codespaces](./references/codespaces.md)

## Organizations (gh org)

[When listing or viewing organizations](./references/organizations.md)

## Search (gh search)

[When searching code, commits, issues, PRs, or repos](./references/search.md)

## Labels (gh label)

[When listing, creating, editing, or cloning labels](./references/labels.md)

## SSH Keys (gh ssh-key)

[When listing, adding, or deleting SSH keys](./references/ssh-keys.md)

## GPG Keys (gh gpg-key)

[When listing, adding, or deleting GPG keys](./references/gpg-keys.md)

## Status (gh status)

[When viewing status overview for repos](./references/status.md)

## Configuration (gh config)

[When listing, getting, or setting gh config](./references/config.md)

## Extensions (gh extension)

[When installing, listing, or creating extensions](./references/extensions.md)

## Aliases (gh alias)

[When setting, listing, or importing aliases](./references/aliases.md)

## API Requests (gh api)

[When making REST or GraphQL API requests via gh](./references/api-requests.md)

## Rulesets (gh ruleset)

[When listing, viewing, or checking rulesets](./references/rulesets.md)

## Attestations (gh attestation)

[When downloading or verifying attestations](./references/attestations.md)

## Completion (gh completion)

[When generating shell completion scripts](./references/completion.md)

## Preview (gh preview)

[When listing or running preview features](./references/preview.md)

## Agent Tasks (gh agent-task)

[When listing, viewing, or creating agent tasks](./references/agent-tasks.md)

## Global Flags

[When using --help, --json, --jq, --web, etc.](./references/global-flags.md)

## Output Formatting

### JSON Output

[When using --json and --jq for structured output](./references/json-output.md)

### Template Output

[When using --template for custom formatting](./references/template-output.md)

## Common Workflows

### Create PR from Issue

[When creating a PR that closes an issue](./references/create-pr-from-issue.md)

### Bulk Operations

[When closing multiple issues or labeling multiple PRs](./references/bulk-operations.md)

### Repository Setup Workflow

[When creating repo with initial setup and labels](./references/repository-setup-workflow.md)

### CI/CD Workflow

[When running workflow and downloading artifacts](./references/ci-cd-workflow.md)

### Fork Sync Workflow

[When forking and syncing with upstream](./references/fork-sync-workflow.md)

## Environment Setup

### Shell Integration

[When adding completion and aliases to shell](./references/shell-integration.md)

### Git Configuration

[When configuring git credential helper for gh](./references/git-configuration.md)

## Best Practices

[When following auth, default repo, jq, pagination, cache practices](./references/best-practices.md)

## Getting Help

[When looking up command help or topics](./references/getting-help.md)

## References

[Official manual, docs, REST API, GraphQL API](./references/external-references.md)
