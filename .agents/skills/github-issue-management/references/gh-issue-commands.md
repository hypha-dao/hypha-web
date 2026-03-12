# GitHub Issue Management Command Recipes

Command recipes for the `github-issue-management` skill.

## Setup

```bash
OWNER="<org-or-user>"
REPO="<repo>"
EPIC_NUMBER="<epic_issue_number>"
TASK_NUMBER="<task_issue_number>"
```

Auth precheck:

```bash
gh auth status
```

## 1) Ensure `epic` label exists

```bash
gh label list --repo "$OWNER/$REPO" --limit 200 | rg "^epic\\b" || \
gh label create epic --repo "$OWNER/$REPO" --color "5319e7" --description "Container issue for larger initiatives"
```

## 2) Create epic and task issues

```bash
# Create epic (container)
gh issue create \
  --repo "$OWNER/$REPO" \
  --title "Epic: Improve onboarding flow" \
  --label epic \
  --body "$(cat <<'EOF'
## Goal
Improve onboarding completion and first-week activation.

## Sub-issues
- (to be populated)
EOF
)"

# Create task
gh issue create \
  --repo "$OWNER/$REPO" \
  --title "Add progress indicator to onboarding" \
  --body "$(cat <<'EOF'
## Parent epic
Parent epic: #<epic_number>

## Acceptance criteria
- Indicator appears on each onboarding step
- Step count and current step are visible
EOF
)"
```

## 3) Get numeric issue `id` for sub-issue API

The sub-issue REST endpoints require `sub_issue_id` (numeric issue id), not issue number.

```bash
SUB_ISSUE_ID="$(gh api "/repos/$OWNER/$REPO/issues/$TASK_NUMBER" --jq '.id')"
echo "$SUB_ISSUE_ID"
```

## 4) Attach task as native sub-issue

```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  "/repos/$OWNER/$REPO/issues/$EPIC_NUMBER/sub_issues" \
  -F sub_issue_id=$SUB_ISSUE_ID
```

Use `-F replace_parent=true` when intentionally moving a task from one epic to another.

## 5) List sub-issues for an epic

```bash
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  "/repos/$OWNER/$REPO/issues/$EPIC_NUMBER/sub_issues?per_page=100"
```

## 6) Get parent of a task issue

```bash
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  "/repos/$OWNER/$REPO/issues/$TASK_NUMBER/parent"
```

## 7) Remove a sub-issue

```bash
gh api \
  --method DELETE \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  "/repos/$OWNER/$REPO/issues/$EPIC_NUMBER/sub_issue" \
  -F sub_issue_id=$SUB_ISSUE_ID
```

## 8) Reprioritize sub-issues

Move one sub-issue after another sub-issue in the same epic:

```bash
AFTER_ID="<another_sub_issue_id>"
gh api \
  --method PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  "/repos/$OWNER/$REPO/issues/$EPIC_NUMBER/sub_issues/priority" \
  -F sub_issue_id=$SUB_ISSUE_ID \
  -F after_id=$AFTER_ID
```

## 9) Add explicit cross-links

Update epic body with sub-issue links:

```bash
gh issue edit "$EPIC_NUMBER" --repo "$OWNER/$REPO" --body "$(cat <<'EOF'
## Goal
Improve onboarding completion and first-week activation.

## Sub-issues
- #123
- #124
- #125
EOF
)"
```

Ensure task references epic:

```bash
gh issue edit "$TASK_NUMBER" --repo "$OWNER/$REPO" --body "$(cat <<'EOF'
## Parent epic
Parent epic: #<epic_number>

## Acceptance criteria
- ...
EOF
)"
```

## 10) Close-readiness check for epic

Only close epic when all sub-issues are closed:

```bash
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  "/repos/$OWNER/$REPO/issues/$EPIC_NUMBER/sub_issues?per_page=100" \
  --jq '[.[] | select(.state != "closed")] | length'
```

If output is `0`, the epic is ready to close.

## Common Errors

- `404` / `403`: wrong repo, issue number, or missing permission.
- `422`: invalid `sub_issue_id`, duplicate relation, or cross-owner issue. Ensure `sub_issue_id` is fetched from REST issue payload (`.id`) and submitted with `-F`.
- `no matches found`: shell interpreted unquoted `?` in endpoint; wrap endpoint in quotes.
- Secondary rate limit: retry in smaller batches with delay.

Source: [GitHub REST API - Sub-issues](https://docs.github.com/en/rest/issues/sub-issues), verified 2026-03-12.
