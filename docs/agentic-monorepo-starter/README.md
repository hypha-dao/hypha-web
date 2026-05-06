# Agentic Monorepo Starter (Hypha Style)

This starter is a copyable baseline for a new project using:

- Vercel + GitHub CI/CD
- Next.js App Router
- AI SDK chat route with tool calling
- Monorepo layout (`apps/*`, `packages/*`)
- Hypha role routing references

## Quick start

1. Copy this folder to a new repo root.
2. Run install and development:

```bash
pnpm install
pnpm dev
```

3. Open <http://localhost:3000>.
4. Ask: "What time is it in Europe/Amsterdam?"

## Vercel setup

```bash
vercel login
vercel link
vercel env pull apps/web/.env.local --yes
```

Set Vercel Root Directory to `apps/web`.

## GitHub setup

Create repo and push:

```bash
gh auth login
gh repo create my-agentic-monorepo --private --source=. --remote=origin --push
```

Add repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Roles + Hypha references

- Main repo: <https://github.com/hypha-dao/hypha-web>
- Agent router: <https://github.com/hypha-dao/hypha-web/blob/main/.agents/AGENTS.md>
- Roles directory: <https://github.com/hypha-dao/hypha-web/tree/main/.agents/roles>

### Active role files

- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/i18n-engineer.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/senior-product-owner.base.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/senior-prompt-engineer.base.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/senior-requirements-engineer.base.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/meta-cognitive-reasoning-expert.base.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/senior-ui-ux-design-engineer.base.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/senior-lead-fullstack-nextjs-engineer.base.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/senior-neon-db-engineer.base.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/senior-qa-test-engineer.base.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/senior-application-security-engineer.base.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/senior-user-researcher.base.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/elite-senior-lead-cursor-engineer.base.md>
- <https://github.com/hypha-dao/hypha-web/blob/main/.agents/roles/expert-mcp-engineer.base.md>

## Adopt roles in your new repo

1. Copy Hypha `/.agents/AGENTS.md`.
2. Copy role files from `/.agents/roles/`.
3. Keep role names stable.
4. Customize role internals for your domain.

## First checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```
