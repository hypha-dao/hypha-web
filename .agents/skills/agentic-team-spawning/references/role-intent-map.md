# Role Intent Map

Map task signals to the minimum set of roles in `.agents/roles`.

## Core Mapping

| Prompt signal / need | Primary role | Add only if needed |
|---|---|---|
| Prompt architecture, LLM behavior, output quality, eval loops | Senior Prompt Engineer | Meta-Cognitive Reasoning Expert (if ambiguity is high) |
| Feature requirements are vague, conflicting, or incomplete | Senior Requirements Engineer | Senior Product Owner (priority/tradeoff decisions) |
| Product scope, roadmap alignment, prioritization | Senior Product Owner | Senior Requirements Engineer (if specs are missing) |
| UI component behavior, interaction design, accessibility UX | Senior UI/UX Design Engineer | Senior QA / Test Engineer (for UI regression strategy) |
| Next.js app/router/server actions/API/fullstack delivery | Senior Lead Fullstack Next.js Engineer | Senior Neon Database Engineer (if schema/query work exists) |
| PostgreSQL schema, migrations, indexing, query tuning, RLS | Senior Neon Database Engineer | Senior Application Security Engineer (for high-risk data paths) |
| i18n locale setup, message keys, `next-intl` routing | i18n Engineer | Senior QA / Test Engineer (if locale test matrix is large) |
| Test planning, Playwright/Vitest, validation strategy | Senior QA / Test Engineer | Senior UI/UX Design Engineer (if UX acceptance criteria unclear) |
| Threat modeling, auth hardening, security review/remediation | Senior Application Security Engineer | Senior Lead Fullstack Next.js Engineer (for implementation) |
| User interviews, persona/journey synthesis, usability research | Senior User Researcher | Senior Product Owner (if prioritization decisions follow) |
| Cross-role deadlocks or complex uncertainty | Meta-Cognitive Reasoning Expert | None by default |
| Cursor rules/skills/agent config, AGENTS or SKILL changes | Elite Senior Lead Cursor Engineer | Senior Prompt Engineer (if prompt architecture is also requested) |

## Disambiguation Rules

1. If one role can fully deliver, use that role only.
2. If implementation + data model changes are both explicit, pair Fullstack + DB.
3. Include QA when the task requests test automation, acceptance evidence, or has broad blast radius.
4. Involve Security for auth, data exposure, untrusted input, secrets, or compliance-sensitive surfaces.
5. Lead with Requirements when acceptance criteria are missing and coding would be speculative.

## Role Name Canonicalization

Use these exact names in orchestrator output:

- i18n Engineer
- Senior Product Owner
- Senior Prompt Engineer
- Senior Requirements Engineer
- Meta-Cognitive Reasoning Expert
- Senior UI/UX Design Engineer
- Senior Lead Fullstack Next.js Engineer
- Senior Neon Database Engineer
- Senior QA / Test Engineer
- Senior Application Security Engineer
- Senior User Researcher
- Elite Senior Lead Cursor Engineer
