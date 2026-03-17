# Review Pull Request

```bash
# Review PR (opens editor)
gh pr review 123

# Approve PR
gh pr review 123 --approve --body "LGTM!"

# Request changes
gh pr review 123 --request-changes \
  --body "Please fix these issues"

# Comment on PR
gh pr review 123 --comment --body "Some thoughts..."

# Dismiss review (use gh api; gh pr review has no --dismiss flag)
gh api -X PUT repos/OWNER/REPO/pulls/123/reviews/REVIEW_ID/dismissals \
  -f message='Dismissing review'
```
