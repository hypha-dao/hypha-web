---
name: github-issue-management
description: Manage GitHub issue hierarchies where `epic` issues are containers and related work is tracked as native sub-issues with cross-links for navigation.
---

# GitHub Issue Management

Standardize issue planning and execution in GitHub using an epic-first hierarchy.

## Core Rules

1. Any issue labeled `epic` is a container issue.
2. Work items related to that topic must be linked as native sub-issues.
3. Keep manual cross-links in both directions for human-friendly navigation.
4. Do not close an epic while open sub-issues remain.

## Prerequisites

- GitHub CLI (`gh`) authenticated (`gh auth status`)
- Repository write access to issues
- `epic` label exists (create it if missing)
- Ability to run `gh` with sufficient environment permissions when sandboxed

## Preferred Workflow

### 0) Session readiness

- Run `gh auth status` before any `gh api` mutation.
- If auth fails in restricted/sandbox mode, rerun with broader execution permissions.
- Quote API endpoints that include `?` (e.g. `".../sub_issues?per_page=100"`) to avoid shell glob expansion errors.

### 1) Intake and classification

- If the request is broad, create/find an epic issue first.
- If the request is concrete implementation work, create a task issue and map it to an existing epic.
- If no epic exists, create one before adding tasks.

### 2) Ensure epic label and epic issue

- Ensure the repository has label `epic`.
- Ensure the container issue has label `epic`.
- Epic title should describe the larger initiative, not a single task.

### 3) Create or identify task issues

- Create focused task issues with single clear outcomes.
- Keep acceptance criteria in task bodies so tasks are independently actionable.
- Reuse existing issues if they already represent the needed work.

### 4) Link tasks as native sub-issues

- Add each task to the epic using native sub-issue APIs.
- Verify parent/sub-issue links after each mutation.
- Avoid duplicate links (same task under same epic twice).

### 5) Add bidirectional cross-links

Use explicit links so humans can navigate quickly in UI and notifications:

- In epic: maintain a `## Sub-issues` section with issue links.
- In each task: include `Parent epic: #<number>` near the top.

If body edits are noisy, add/update a pinned maintenance comment instead.

### 6) Ongoing maintenance

- List sub-issues regularly; identify orphan tasks and attach them.
- Reprioritize sub-issues as scope changes.
- Remove sub-issues that no longer belong and update cross-links.
- Before closing epic, verify all sub-issues are closed (or explicitly excluded).

## Quality Checks

Run these checks whenever hierarchy changes:

1. Epic still has `epic` label.
2. Every related task is attached as a native sub-issue.
3. Epic body/comment list matches actual native sub-issue list.
4. Every sub-issue points back to the epic.
5. No duplicate or stale links.

## Failure Handling

- **404/403 from sub-issue API:** verify repo owner/name, permissions, and issue numbers.
- **422 validation errors:** confirm `sub_issue_id` is the numeric REST issue `id` (not issue number or GraphQL node id), and submit numeric fields with `gh api -F` instead of `-f`.
- **Shell expansion errors (e.g. `no matches found`):** quote endpoint URLs that include query strings.
- **Rate limiting:** batch operations, then retry with backoff.
- **Legacy-only repos/processes:** still keep cross-links even if native linking is temporarily blocked.

## Examples

### New initiative

1. Create epic issue and apply `epic`.
2. Create three task issues.
3. Attach all three as native sub-issues.
4. Update epic `## Sub-issues` list and task `Parent epic` links.

### Existing epic expansion

1. Locate epic by `label:epic`.
2. Create missing task issue(s).
3. Attach and verify with sub-issue listing endpoint.
4. Sync cross-links.

### Migrate loose backlog

1. Find issues related to a larger topic.
2. Create/identify epic and label it `epic`.
3. Attach selected issues as sub-issues.
4. Add parent and child cross-links.

## Execution Reference

Use command recipes in `references/gh-issue-commands.md` for:

- label management
- epic/task creation
- sub-issue add/list/remove/reprioritize
- cross-link updates
- close-readiness checks

Documentation source: GitHub REST API "Sub-issues" (`/rest/issues/sub-issues`), verified 2026-03-12.
