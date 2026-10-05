### Code Quality Best Practices

#### Do

- Use TypeScript strict mode — no `any`, explicit return types on exports
- Respect package boundaries: `storage-postgres` -> `core` -> `epics` -> `ui` (never reverse)
- Keep server actions thin — delegate to mutations/queries in `core`
- Pass `{ db: DatabaseInstance }` as config — never import `db` directly in queries
- Use `PaginatedResponse<T>` and `PaginationParams` for all list endpoints
- Co-locate related code: queries, mutations, actions, types per domain in `core`
- Use barrel exports (`index.ts`) sparingly — prefer explicit imports

#### Avoid

- Importing from `./server` paths in client components
- Putting business logic in UI components — extract to `core` hooks or server actions
- Creating circular dependencies between packages
- Using raw SQL when Drizzle query builder suffices
- Duplicating types across packages — define once in `core`, re-export as needed
- Mixing concerns: one file should do one thing (query OR mutation OR component)
