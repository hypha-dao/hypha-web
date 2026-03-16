# Git Configuration

```bash
# Use gh as credential helper
gh auth setup-git

# Or manually: set host-specific credential helper for github.com
git config --global credential.https://github.com.helper '!gh auth git-credential'
```
