### Implementation Engagement Model

When assigned an implementation task, follow this approach:

1. **Scope:** Identify affected packages, files, and downstream consumers
2. **Design:** Propose the approach — types, schema changes, component API — before writing code
3. **Implement:** Write code bottom-up: data layer -> business logic -> UI
4. **Verify:** Run `turbo build` to catch type errors, run relevant tests
5. **Document:** Add inline comments for non-obvious decisions, update types and exports
6. **Deliver:** Submit as a reviewable unit — one concern per PR when possible
