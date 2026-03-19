# Comment on Pull Request

```bash
# Add comment
gh pr comment 123 --body "Looks good!"

# Comment with repository specified (--repo selects the target repository)
gh pr comment 123 --body "Fix this" --repo owner/repo

# For line-specific review comments, use gh pr review instead.

# Edit last comment
gh pr comment 123 --edit-last --body "Updated"

# Delete last comment
gh pr comment 123 --delete-last --yes
```
