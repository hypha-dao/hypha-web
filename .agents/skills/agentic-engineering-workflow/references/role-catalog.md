# Role Catalog

Complete mapping of task domains to specialist roles. Use this to decide which roles to activate for a given engineering task.

## Role Selection Matrix

| Role | File | Trigger domains | Trigger signals in user request |
|---|---|---|---|
| Senior Lead Fullstack Next.js Engineer | `senior-lead-fullstack-nextjs-engineer.base.md` | API routes, server actions, RSC, middleware, caching, App Router | "API", "route handler", "server action", "middleware", "revalidation", "Next.js" |
| Senior UI/UX Design Engineer | `senior-ui-ux-design-engineer.base.md` | Components, design system, Tailwind, accessibility, Figma-to-code | "component", "UI", "design", "Tailwind", "responsive", "Figma" |
| Senior Neon Database Engineer | `senior-neon-db-engineer.base.md` | Schema, migrations, queries, indexes, RLS, Drizzle ORM | "database", "schema", "migration", "query", "Drizzle", "Neon", "SQL" |
| Senior Application Security Engineer | `senior-application-security-engineer.base.md` | Auth, OWASP, CSP, CORS, secrets, input validation | "security", "auth", "OWASP", "XSS", "CSRF", "secrets", "permissions" |
| i18n Engineer | `i18n-engineer.md` (not `*.base.md`) | Translations, locale routing, next-intl | "translate", "i18n", "locale", "language", "next-intl" |
| Senior QA / Test Engineer | `senior-qa-test-engineer.base.md` | Testing, Playwright, Vitest, accessibility, CI test config | **Always included — no signal required** |
| Senior Product Owner | `senior-product-owner.base.md` | Requirements clarification, acceptance criteria, prioritization | Activate when task scope is ambiguous or user asks for product framing |
| Senior Prompt Engineer | `senior-prompt-engineer.base.md` | Prompt/system-message design, skill authoring, instruction quality | "prompt", "system message", "skill file", "instruction quality", "optimize prompt" |
| Senior Requirements Engineer | `senior-requirements-engineer.base.md` | Feature decomposition, requirement specs, implementation tickets | Activate when task needs breaking into sub-tasks or specs |
| Senior User Researcher | `senior-user-researcher.base.md` | Usability, personas, journey maps, user flows | "user research", "usability", "persona", "journey map" |
| Meta-Cognitive Reasoning Expert | `meta-cognitive-reasoning-expert.base.md` | Complex trade-off analysis, architectural decisions | Activate when multiple valid approaches exist with significant trade-offs |
| Elite Senior Lead Cursor Engineer | `elite-senior-lead-cursor-engineer.base.md` | Cursor config, rules, skills, AGENTS.md, MCP | "Cursor", "rule", "skill", "AGENTS.md", "MCP" |

## Skill Augmentation

Some roles benefit from pairing with specific skills. Instruct subagents to load these skills when relevant:

| Skill | Pair with role(s) | When |
|---|---|---|
| `i18n-translate` | i18n Engineer | Any translation work |
| `engineering-github-actions` | Fullstack Engineer | CI/CD pipeline changes |
| `hypha-ui-stack` | UI/UX Design Engineer, Fullstack Engineer | Component implementation |
| `ai-sdk` | Fullstack Engineer | AI-powered features |
| `optimizing-monorepo-performance` | Fullstack Engineer | Build/CI performance work |
| `conventional-commits` | **All subagents + orchestrator** | Every subagent commits its own changes; orchestrator commits any leftovers in Phase 7 |
| `gh-cli` | (orchestrator itself) | PR creation in Phase 7 — mandatory, never skipped |
| `code-review` | (orchestrator itself) | Review gate in Phase 6 |

## Selection Heuristics

### Multi-domain tasks

When a task spans 3+ domains, activate all relevant roles. The overhead of an extra subagent is far lower than the cost of missing a domain-specific concern.

### Ambiguous scope

When unsure which roles to activate:

1. Start with the Fullstack Engineer (broadest coverage)
2. Add QA (mandatory)
3. Add Security if the task touches auth, user input, or data access
4. Add domain specialists only when the task clearly enters their territory

### Minimal tasks

For small tasks (single file, single concern), still activate:

1. The one relevant implementation role
2. QA (mandatory — run minimal verification)

Even one-line changes can introduce regressions. The QA gate catches what the implementer's tunnel vision misses.
