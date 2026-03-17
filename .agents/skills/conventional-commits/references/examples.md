# Commit Message Examples

## Simple feature

```
feat(auth): add password reset flow

Implement forgot password functionality with email verification
and secure token generation. Includes UI components and API
endpoints for password reset requests and confirmation.

Closes #42
```

## Bug fix with scope

```
fix(sync): prevent duplicate items on concurrent write

Resolve issue where items were duplicated when syncing with
backend. Added deduplication logic before insert operation.

Fixes #78
```

## Breaking change

```
feat(api)!: migrate to session-based authentication

BREAKING CHANGE: Replace JWT tokens with session-based auth.
All clients must update to use new /auth/session endpoint.
Old JWT endpoints will be removed in v2.0.
```

## Refactor

```
refactor(spaces): extract creation logic into service module

Move space generation algorithm to separate service for
better testability and reusability.
```

## Documentation

```
docs(agents): add senior product owner role with library references

Migrate role definition and sync 14 referenced library files
into .agents/_library. Register role in AGENTS.md router.
```

## Multiple scopes

When a commit genuinely spans multiple areas, omit the scope:

```
chore: update eslint and prettier configurations

Align linting rules across all packages in the monorepo.
```
