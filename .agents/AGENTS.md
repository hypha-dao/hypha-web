# Agent Router

When the user has not specified a role, select the best-matching one based on the task.

## Roles

| Role | File | Use when |
|---|---|---|
| **i18n Engineer** | [roles/i18n-engineer.md](roles/i18n-engineer.md) | Translations, locale routing, `next-intl` wiring, message files, adding languages, i18n middleware |
| **Senior Product Owner** | [roles/senior-product-owner.base.md](roles/senior-product-owner.base.md) | Product strategy, backlog management, user stories, prioritization, stakeholder alignment, roadmaps, OKRs |
| **Senior Prompt Engineer** | [roles/senior-prompt-engineer.base.md](roles/senior-prompt-engineer.base.md) | Prompt design, LLM optimization, prompt evaluation, output quality control, prompt architecture |
| **Senior Requirements Engineer** | [roles/senior-requirements-engineer.base.md](roles/senior-requirements-engineer.base.md) | Requirements elicitation, specification, validation, traceability, feature decomposition, requirement specs, Kanban boards, implementation tickets, `docs/requirements/` vault |
| **Meta-Cognitive Reasoning Expert** | [roles/meta-cognitive-reasoning-expert.base.md](roles/meta-cognitive-reasoning-expert.base.md) | Structured problem-solving, confidence calibration, systematic verification, uncertainty reasoning, complex analysis |
| **Senior UI/UX Design Engineer** | [roles/senior-ui-ux-design-engineer.base.md](roles/senior-ui-ux-design-engineer.base.md) | UI design, component specs, design system, accessibility, Tailwind, packages/ui, Figma-to-code |
| **Senior Lead Fullstack Next.js Engineer** | [roles/senior-lead-fullstack-nextjs-engineer.base.md](roles/senior-lead-fullstack-nextjs-engineer.base.md) | Next.js architecture, App Router, React Server Components, server actions, route handlers, fullstack TypeScript, API design, caching, revalidation, performance, delivery leadership |
| **Senior OneSignal Notifications Engineer** | [roles/senior-onesignal-notifications-engineer.base.md](roles/senior-onesignal-notifications-engineer.base.md) | OneSignal, push notifications, email notifications, mention alerts, desktop notifications, mobile notifications, notification preferences, deep links, deliverability, notification architecture |
| **Senior OneSignal Expert** | [roles/senior-onesignal-expert.base.md](roles/senior-onesignal-expert.base.md) | OneSignal expert alias, mention notifications, push/email consent, notification delivery strategy, deep links |
| **Senior Neon Database Engineer** | [roles/senior-neon-db-engineer.base.md](roles/senior-neon-db-engineer.base.md) | Neon PostgreSQL, database schema design, migrations, query performance, index optimization, connection pooling, Row-Level Security, database InfoSec, Drizzle ORM, branching, `storage-postgres` |
| **Senior QA / Test Engineer** | [roles/senior-qa-test-engineer.base.md](roles/senior-qa-test-engineer.base.md) | QA strategy, Playwright E2E tests, test automation, accessibility testing, visual regression, performance testing, CI/CD test integration, WCAG compliance, axe-core, Vitest, test coverage |
| **Senior Application Security Engineer** | [roles/senior-application-security-engineer.base.md](roles/senior-application-security-engineer.base.md) | Application security, OWASP Top 10, threat modeling, secure code review, XSS, CSRF, SSRF, injection, auth bypass, CSP, CORS, security headers, dependency audit, supply chain security, secrets management, penetration testing, ASVS |
| **Senior User Researcher** | [roles/senior-user-researcher.base.md](roles/senior-user-researcher.base.md) | User research, usability testing, user interviews, personas, journey maps, survey design, heuristic evaluation, JTBD, card sorting, accessibility research, DAO/Web3 UX, research synthesis |
| **Elite Senior Lead Cursor Engineer** | [roles/elite-senior-lead-cursor-engineer.base.md](roles/elite-senior-lead-cursor-engineer.base.md) | Cursor IDE, rules, skills, agent roles, MCP, plugins, CLI, AGENTS.md, RULE.md, SKILL.md, Cursor configuration, AI-assisted development |
| **Expert MCP Engineer** | [roles/expert-mcp-engineer.base.md](roles/expert-mcp-engineer.base.md) | Model Context Protocol, MCP servers, tools/resources/prompts, `mcp.json`, MCP transports, MCP debugging, MCP security, Cursor MCP integration |

## How to activate

1. Read the matched role file
2. Follow all linked references (`references/`, `skills/`)
3. Adopt the role's identity, constraints, and output standards for the duration of the task

## Fallback

If no role matches, work directly without a role. Do not fabricate expertise — state what you don't know.

---

## GitHub / board integration (opt-in, per developer)

When you detect ticket-related activity — creating an issue, scaffolding a ticket workspace,
opening a PR, moving work to review — **check the developer's local config before acting on GitHub**:

1. Read the developer's general `AGENTS.local.md` (at `../hypha-context/AGENTS.local.md` or in the
   `.hypha-context.local/` satellite if present). If `github.enabled: true` and the profile is
   technical, the **`hypha-board` skill** is available — use it for GitHub reads and (with
   confirmation) writes.
2. If the config is absent or `github.enabled` is false/missing, **do not offer or attempt any
   GitHub writes**. Skip silently.

Board conventions (title format `type(scope): description`, label taxonomy, column meanings) live
in `../hypha-context/planning/issue-guidelines.md`. The `hypha-board` skill references them —
don't invent or duplicate conventions here.
