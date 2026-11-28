# Agent Prompts

Modular system prompts for AI agent roles on the Hypha platform.

## Architecture

Each role in `prompts/` is a system message that composes its behavior from shared modules in `_library/`. Roles link to library modules via relative Markdown references — a prompt consumer resolves these links and inlines the referenced content to produce a complete, flattened system prompt.

```
prompts/{role}.md          -- Role identity + module composition
_library/{category}/*.md   -- Reusable building blocks
```

## Roles

| Role                        | File                         | Description                                                              |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| **Lead Engineer**           | `lead-engineer.md`           | Full-stack architect, owns technical decisions, delegates to specialists |
| **QA Engineer**             | `qa-engineer.md`             | Quality across web, API, and smart contract layers                       |
| **UI/UX Engineer**          | `ui-ux-engineer.md`          | Design system, components, styling, accessibility                        |
| **Database Engineer**       | `database-engineer.md`       | Drizzle schemas, migrations, queries, RLS                                |
| **Smart Contract Engineer** | `smart-contract-engineer.md` | Solidity contracts on Base chain                                         |
| **Product Owner**           | `product-owner.md`           | Requirements, priorities, acceptance criteria                            |
| **Team Orchestrator**       | `team-orchestrator.md`       | Multi-agent coordination and task delegation                             |
| **Prompt Engineer**         | `prompt-engineer.md`         | Prompt design and optimization                                           |
| **i18n Engineer**           | `i18n-engineer.md`           | Locale routing, dictionaries, translation infrastructure                 |
| **Laconic Executor**        | `senior-laconic-executor.md` | Minimal-output task executor                                             |

## Library Categories

| Category             | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `domain/`            | Hypha platform domain knowledge (entities, flows, terminology) |
| `competencies/`      | What the agent knows (tech stack, patterns, tools)             |
| `best-practices/`    | Do/don't guidelines per domain                                 |
| `frameworks/`        | Structured evaluation and decision-making models               |
| `methodologies/`     | Process lifecycles and workflows                               |
| `deliverables/`      | What the agent produces                                        |
| `collaboration/`     | How agents coordinate and hand off work                        |
| `communication/`     | Voice and communication style                                  |
| `engagement-models/` | How agents approach different task types                       |
| `output-standards/`  | Formatting and quality standards for output                    |
| `tools/`             | Development and testing tooling references                     |

## Role Hierarchy

```
Lead Engineer (architecture, review, delegation)
  |-- UI/UX Engineer (components, styling, a11y)
  |-- QA Engineer (testing, quality gates, bug reports)
  |-- Database Engineer (schema, migrations, queries)
  |-- Smart Contract Engineer (Solidity, deployment, on-chain)
  |-- i18n Engineer (locale routing, dictionaries, translations)
```

Product Owner provides requirements. Team Orchestrator coordinates across roles.

## Adding a New Role

1. Create `prompts/{role-name}.md` with identity paragraph
2. Add `## Domain` section linking to `../_library/domain/hypha-platform.md`
3. Compose remaining sections from existing `_library/` modules
4. Create new `_library/` modules only if no existing module covers the need
5. Update this README with the new role
