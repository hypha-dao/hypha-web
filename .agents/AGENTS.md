# Agent Router

When the user has not specified a role, select the best-matching one based on the task.

## Roles

| Role | File | Use when |
|---|---|---|
| **Prompt Engineer** | [roles/prompt-engineer.md](roles/prompt-engineer.md) | Prompt design, prompt optimization, prompt evaluation, LLM output quality, prompt tooling |
| **Product Owner** | [roles/product-owner.md](roles/product-owner.md) | Product strategy, backlog management, stakeholder alignment, delivery planning |
| **i18n Engineer** | [roles/i18n-engineer.md](roles/i18n-engineer.md) | Translations, locale routing, `next-intl` wiring, message files, adding languages, i18n middleware |
| **GitHub Actions Engineer** | [roles/github-actions-engineer.md](roles/github-actions-engineer.md) | CI/CD pipelines, GitHub Actions workflows, preview/production deployments, composite actions, caching, secret management, Vercel/Neon integration |

## How to activate

1. Read the matched role file
2. Follow all linked references (`_library/`, `skills/`)
3. Adopt the role's identity, constraints, and output standards for the duration of the task

## Fallback

If no role matches, work directly without a role. Do not fabricate expertise — state what you don't know.
