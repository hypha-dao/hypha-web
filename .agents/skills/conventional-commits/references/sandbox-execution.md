# Sandbox Execution & GPG Signing

## Permission Requirements

In sandboxed environments (e.g., Cursor IDE):

1. **Standard sandbox** blocks git write operations
2. **`git_write` permission** allows staging and committing
3. **`all` permission** required when GPG signing is enabled

Always request `all` permissions to preserve GPG signing.

## GPG Signing Errors

If commit fails with:

```text
error: gpg failed to sign the data
gpg: can't connect to the agent: Operation not permitted
fatal: failed to write commit object
```

**Cause:** Sandbox restrictions prevent GPG agent communication.

**Solution:** Request full permissions to bypass sandbox:

```bash
# In Cursor: use required_permissions: ["all"]
git add <files> && git commit -m "..."
```

**Alternative:** Disable signing for a single commit (only with explicit user approval):

```bash
git commit --no-gpg-sign -m "..."
```

Default to requesting `all` permissions rather than skipping GPG.
