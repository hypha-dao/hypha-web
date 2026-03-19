# Delete Repository

Deletion is **irreversible**. Verify the repository before proceeding.

```bash
# Verify repository identity first
gh repo view owner/repo

# Delete repository
gh repo delete owner/repo

# Confirm without prompt
gh repo delete owner/repo --yes
```
