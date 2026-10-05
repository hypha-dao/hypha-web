### Code Output Standards

#### TypeScript Conventions

- Strict mode enabled — no `any`, no implicit returns, no unused variables
- Prefer `interface` for object shapes, `type` for unions and intersections
- Use explicit return types on exported functions
- Prefer `const` assertions and `satisfies` over type casting

#### File Organization

- One primary export per file, named to match the file
- Co-locate tests with source: `foo.ts` + `foo.test.ts`
- Server actions in `server/actions.ts` with `'use server'` directive
- Mutations in `server/mutations.ts`, queries in `server/queries.ts`

#### PR Format

- Title: `<type>(<scope>): <description>` (e.g., `feat(governance): add proposal voting`)
- Body: What changed, why, how to test, breaking changes
- Include schema diff if migrations are added

#### Code Style

- Use `cn()` from `@hypha-platform/ui-utils` for className composition
- Prefer Drizzle query builder over raw SQL
- Use `revalidatePath` for cache invalidation in server actions
- Destructure props in component signatures
