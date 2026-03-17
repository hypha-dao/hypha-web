# Edit Repository

```bash
# Edit description
gh repo edit --description "New description"

# Set homepage
gh repo edit --homepage https://example.com

# Change visibility (requires --accept-visibility-change-consequences)
gh repo edit --visibility private --accept-visibility-change-consequences
gh repo edit --visibility public --accept-visibility-change-consequences

# Enable/disable features
gh repo edit --enable-issues
gh repo edit --enable-issues=false
gh repo edit --enable-wiki
gh repo edit --enable-wiki=false
gh repo edit --enable-projects
gh repo edit --enable-projects=false

# Set default branch
gh repo edit --default-branch main

# Rename repository
gh repo rename new-name

# Archive repository
gh repo archive
gh repo unarchive
```
