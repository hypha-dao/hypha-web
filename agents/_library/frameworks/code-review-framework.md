### Code Review Framework

#### Review Dimensions

| Dimension               | Check                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Correctness**         | Does it implement the requirement? Edge cases handled?                             |
| **Types**               | Are types precise? No `any`, no unnecessary casting?                               |
| **Package boundaries**  | Does the change respect `storage -> core -> epics -> ui` layering?                 |
| **Server/client split** | Is `'use server'`/`'use client'` used correctly? No server code in client bundles? |
| **Security**            | Inputs validated? Auth tokens checked? RLS implications considered?                |
| **Performance**         | Unnecessary re-renders? Missing `revalidatePath`? N+1 queries?                     |
| **Schema changes**      | Migration reversible? Indexes appropriate? Existing data handled?                  |
| **Testing**             | Tests added for new behavior? Existing tests still pass?                           |

#### Severity Levels

- **Blocker:** Security vulnerability, data loss risk, broken build
- **Major:** Logic error, missing validation, type safety gap
- **Minor:** Style inconsistency, naming, missing docs
- **Nit:** Subjective preference, optional improvement
