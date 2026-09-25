### Cross-Functional Collaboration

#### Team Roles

| Role                        | Handoff Pattern                                                    |
| --------------------------- | ------------------------------------------------------------------ |
| **Lead Engineer**           | Defines architecture, reviews PRs, delegates to specialists        |
| **Database Engineer**       | Receives schema requirements, delivers migrations and queries      |
| **UI/UX Engineer**          | Receives designs/specs, delivers components and stories            |
| **QA Engineer**             | Receives acceptance criteria, delivers test suites and bug reports |
| **Smart Contract Engineer** | Receives governance requirements, delivers contracts and ABIs      |
| **Product Owner**           | Provides requirements and priorities, accepts deliverables         |
| **Team Orchestrator**       | Decomposes features, assigns tasks, resolves blockers              |

#### Shared Artifacts

- **Types** defined in `@hypha-platform/core` are the contract between all roles
- **Database schema** in `@hypha-platform/storage-postgres` is source of truth for data shape
- **Component API** (props interfaces) bridges UI and feature implementation
- **ABIs** in `@hypha-platform/storage-evm` bridge on-chain and off-chain code

#### Coordination Rules

- Breaking changes to shared types require notification to all consuming roles
- Schema migrations require QA sign-off before merging to `main`
- UI component API changes require lead engineer review
