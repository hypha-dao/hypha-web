# Glossary

Shared terminology for the requirements vault. Use these terms consistently across all requirement specs, tickets, and board cards.

## Requirement Types

| Term | Prefix | Definition |
|------|--------|------------|
| **Functional Requirement** | `FR-*` | A capability the system must provide — an observable behavior or function |
| **Non-functional Requirement** | `NFR-*` | A quality attribute or constraint (performance, security, reliability, etc.) |
| **Acceptance Criterion** | `AC-*` | A testable condition that must be satisfied for a requirement to be considered complete |
| **Parity Constraint** | `PAR-*` | A requirement to match existing behavior from a prototype or prior implementation |

## Requirement Language

| Keyword | Meaning |
|---------|---------|
| **SHALL** | Mandatory — the system must do this; failure is a defect |
| **SHOULD** | Recommended — expected unless there is a documented reason to deviate |
| **MAY** | Optional — permitted but not required |

## Master Board Columns

| Column | Meaning | Who Acts |
|--------|---------|----------|
| **Backlog** | Identified need, not yet analyzed | Product / stakeholders |
| **In Refinement** | Requirements agent is writing/decomposing the spec | Requirements agent |
| **Ready for Implementation** | Spec is complete, reviewed, and decomposed into tickets | — (handoff point) |
| **In Progress** | Implementation agents are actively working on tickets | Implementation agents |
| **Done** | All tickets complete and verified | — |

## Feature Board Columns

| Column | Meaning | Who Acts |
|--------|---------|----------|
| **Todo** | Ticket defined, not yet started | — |
| **In Progress** | Implementation agent is actively working | Implementation agent |
| **In Review** | Implementation complete, awaiting verification | Reviewer / human |
| **Done** | Acceptance criteria verified | — |

## Agent Roles

| Role | Responsibility |
|------|---------------|
| **Requirements Agent** | Elicits, analyzes, specifies, and decomposes requirements into actionable tickets |
| **Implementation Agent** | Picks up tickets, implements changes in the codebase, checks off acceptance criteria |
| **Review Agent / Human** | Validates that implementation meets acceptance criteria and requirement intent |

## Document Statuses

| Status | Meaning |
|--------|---------|
| **Draft** | Initial authoring, incomplete or unreviewed |
| **Review** | Content complete, awaiting stakeholder or peer review |
| **Approved** | Reviewed and accepted as the requirements baseline |

## Ticket Statuses (frontmatter)

| Status | Meaning |
|--------|---------|
| **todo** | Defined but not started |
| **in-progress** | Actively being implemented |
| **in-review** | Implementation complete, under review |
| **done** | Acceptance criteria verified |
| **blocked** | Cannot proceed — see Implementation Notes for reason |
