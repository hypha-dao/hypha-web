# Agent configuration

This directory holds **Cursor agent roles**, shared **reference** material, and **skills** (task-specific workflows). Together they define how AI assistants behave in this repository.

## Start here

- **[AGENTS.md](AGENTS.md)** — Agent router: when no role is specified, the assistant picks the best match from the role table. Use it to see every role, its file, and when to use it.

## What lives here

| Path          | Purpose                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| `AGENTS.md`   | Router table and activation instructions                                              |
| `roles/`      | Role system prompts (`.base.md` files and `i18n-engineer.md`)                         |
| `references/` | Reusable competencies, frameworks, methodologies, and standards linked from roles     |
| `skills/`     | Discoverable skills (`SKILL.md`) for focused workflows (e.g. i18n, UI stack, commits) |

## For non-developers

If you are not writing code day to day, these roles usually match product, research, and design work best:

| Priority | Role                             | Use when                                                                              |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| Primary  | **Senior Product Owner**         | Strategy, backlog, prioritization, user stories, stakeholders, roadmaps               |
| Primary  | **Senior User Researcher**       | Research design, interviews, usability, personas, journey maps, synthesis             |
| Often    | **Senior Requirements Engineer** | Clear specifications, traceability, requirements vault / tickets alignment            |
| Often    | **Senior UI/UX Design Engineer** | Visual and interaction design, accessibility, design system, UI implementation detail |

**Sometimes useful**

- **Meta-Cognitive Reasoning Expert** — Structured analysis, uncertainty, and validation on complex or ambiguous decisions.
- **Senior Prompt Engineer** — If you own LLM prompts, evaluation, or output quality for AI features.

Engineering-focused roles (e.g. fullstack Next.js, database, QA, security, i18n, Cursor tooling) are aimed at people building and operating the software; use them when the task is explicitly technical.

## For developers

Follow [AGENTS.md](AGENTS.md) for role selection. New roles belong in `roles/` and should be registered in the router. See the [create-agent-role skill](skills/create-agent-role/SKILL.md) for the full workflow.
