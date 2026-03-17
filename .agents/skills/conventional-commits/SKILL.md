---
name: conventional-commits
description: Generate and execute conventional commit messages by analyzing git diffs and conversation context. Use when creating git commits, generating commit messages, or documenting changes in conventional commit format.
---

# Conventional Commits

Generate conventional commit messages by analyzing code changes and conversation context.

## Workflow

### 1. Format Before Commit

- **Always** run `pnpm run format:fix` before staging or committing. This uses the project's Prettier config from `package.json`.

### 2. Gather Context

- Run `git status` and `git diff` (or `git diff --staged`) to analyze changes
- Run `git log --oneline -10` to match the repository's commit style
- Review conversation history for user intent, decisions, and breaking changes

### 3. Classify Changes

| Type | Use when |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `build` | Build system or external dependencies |
| `ci` | CI configuration |
| `chore` | Other changes (not src or test) |
| `revert` | Reverts a previous commit |

### 4. Determine Scope

Identify the affected area as a lowercase noun: component, module, or feature name (e.g., `auth`, `api`, `i18n`). Omit scope when the change spans multiple areas.

### 5. Write Message

Format: `<type>(<scope>): <subject>`

**Subject rules:**
- Imperative present tense: "add" not "added"
- No capital first letter, no trailing period
- Maximum 72 characters
- Describe what the commit does, not what was done

**Body** (optional, separate with blank line):
- Explain what and why, not how
- Wrap at 72 characters
- Reference issues: `Closes #123`, `Refs #456`

**Footer** (optional):
- Breaking changes: `BREAKING CHANGE: <description>` or `!` after type/scope
- Issue references

See `references/examples.md` for concrete examples by type.

## Executing Commits

**CRITICAL:** Always run the project's format script before committing:

```bash
pnpm run format:fix
```

Then stage and commit:

```bash
git add <files> && git commit -m "$(cat <<'EOF'
<type>(<scope>): <subject>

<body>

<footer>
EOF
)"
```

In sandboxed environments (Cursor IDE), request `all` permissions to preserve GPG signing. See `references/sandbox-execution.md` if commits fail.

## Pre-Commit Checklist

- [ ] **Format applied** — `pnpm run format:fix` has been run (required)
- [ ] Correct files staged (`git status`)
- [ ] Diff matches intent (`git diff --staged`)
- [ ] Message follows conventional format
- [ ] One logical change per commit

## Best Practices

- Be specific: "fix login bug" → `fix(auth): handle expired token refresh`
- Group related changes into one logical commit
- Use conversation context to clarify intent and identify breaking changes
- Reference issues and PRs when applicable
- Explain why in the body for non-obvious changes

## References

- `references/examples.md` — Commit message examples by type
- `references/sandbox-execution.md` — GPG signing and Cursor sandbox troubleshooting
