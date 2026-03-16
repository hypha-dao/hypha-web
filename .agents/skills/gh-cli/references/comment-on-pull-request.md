# Comment on Pull Request

```bash
# Add comment
gh pr comment 123 --body "Looks good!"

# Comment on specific line
gh pr comment 123 --body "Fix this" --repo owner/repo

# Edit last comment
gh pr comment 123 --edit-last --body "Updated"

# Delete last comment
gh pr comment 123 --delete-last --yes
```
