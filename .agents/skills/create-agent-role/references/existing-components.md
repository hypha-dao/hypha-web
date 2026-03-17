# Existing References Components

Catalog of reusable components in `.agents/references/`. Scan this before creating a new role to maximize reuse.

## Competencies (`references/competencies/`)

| File | Domain | Used by |
|------|--------|---------|
| `product-vision.md` | Product strategy & vision | Senior Product Owner |
| `backlog-management.md` | Backlog grooming & prioritization | Senior Product Owner |
| `stakeholder-management.md` | Stakeholder alignment | Senior Product Owner |
| `agile-delivery.md` | Agile & delivery excellence | Senior Product Owner |
| `discovery-validation.md` | Product discovery & validation | Senior Product Owner |
| `requirements-engineering.md` | Requirements elicitation & spec | Senior Requirements Engineer |
| `typescript-monorepo.md` | TypeScript monorepo patterns | i18n Engineer |
| `nextjs-app-router.md` | Next.js App Router | i18n Engineer |
| `i18n-engineering.md` | Internationalization | i18n Engineer |
| `prompt-architecture.md` | Prompt system design | Senior Prompt Engineer |
| `llm-understanding.md` | LLM capabilities & limitations | Senior Prompt Engineer |
| `output-quality-control.md` | Output evaluation & guardrails | Senior Prompt Engineer |
| `meta-cognitive-reasoning.md` | Structured reasoning | Meta-Cognitive Reasoning Expert |
| `critical-analysis.md` | Critical thinking & analysis | Meta-Cognitive Reasoning Expert |
| `information-synthesis.md` | Information integration | Meta-Cognitive Reasoning Expert |

## Frameworks (`references/frameworks/`)

| File | Purpose |
|------|---------|
| `product-metrics-kpis.md` | Product metrics & KPI frameworks |
| `user-story-format.md` | User story writing format |
| `invest-criteria.md` | INVEST criteria for stories |
| `prompt-engineering-techniques.md` | Prompt design techniques |
| `meta-cognitive-reasoning-protocol.md` | Reasoning protocol |
| `evaluation-framework.md` | Evaluation methodology |

## Methodologies (`references/methodologies/`)

| File | Purpose |
|------|---------|
| `product-development-lifecycle.md` | Product dev lifecycle |
| `prioritization-frameworks.md` | Prioritization methods |
| `development-lifecycle.md` | Software dev lifecycle |
| `requirements-lifecycle.md` | Requirements lifecycle |
| `prompt-development-lifecycle.md` | Prompt development |
| `reasoning-lifecycle.md` | Reasoning process |

## Best Practices (`references/best-practices/`)

| File | Purpose |
|------|---------|
| `product-ownership.md` | Product ownership practices |
| `code-quality.md` | Code quality standards |
| `i18n.md` | i18n best practices |
| `requirements-engineering.md` | Requirements engineering |
| `prompt-engineering.md` | Prompt engineering |
| `truthfulness-integrity.md` | Truthfulness & integrity |

## Deliverables (`references/deliverables/`)

| File | Purpose |
|------|---------|
| `product-artifacts.md` | Product deliverable templates |
| `requirements-artifacts.md` | Requirements deliverables |
| `i18n-deliverables.md` | i18n deliverables |
| `prompt-engineering.md` | Prompt deliverables |

## Collaboration (`references/collaboration/`)

| File | Purpose |
|------|---------|
| `cross-functional-teams.md` | Cross-functional collaboration |
| `cross-functional.md` | Cross-functional patterns |
| `prompt-engineering-teams.md` | Prompt eng team collaboration |

## Engagement Models (`references/engagement-models/`)

| File | Purpose |
|------|---------|
| `product-engagement.md` | Product engagement model |
| `consulting-engagement.md` | Consulting engagement model |
| `implementation-engagement.md` | Implementation engagement |

## Output Standards (`references/output-standards/`)

| File | Purpose |
|------|---------|
| `structured-outputs.md` | Structured output format |
| `code-output-standards.md` | Code output standards |
| `prompt-output-standards.md` | Prompt output standards |
| `confidence-based-outputs.md` | Confidence-calibrated outputs |
| `actionable-recommendations.md` | Actionable recommendation format |

## Other (`references/`)

| Path | Purpose |
|------|---------|
| `tools/development-tooling.md` | Dev tools & environment |
| `tools/prompt-development-tools.md` | Prompt dev tools |
| `domain/hypha-platform.md` | Hypha platform domain knowledge |

## Reuse Guidelines

**Always reuse** when a component matches your role's needs. Common cross-role components:

- `consulting-engagement.md` — fits most technical/advisory roles
- `code-quality.md` — fits all engineering roles
- `structured-outputs.md` — fits most roles
- `cross-functional-teams.md` — fits collaborative roles

**Create new** when:
- No existing component covers the domain (e.g., new technology competency)
- The component would be reusable by 2+ future roles
- Keep files <200 lines; one concept per file

**Keep inline** when:
- Content is unique to this role and unlikely to be reused
- Technology-specific architecture philosophy or patterns
- Role-specific response protocols
