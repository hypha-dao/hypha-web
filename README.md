# hypha-web

Hypha monorepo for web apps and shared packages.

## Prerequisites

- Node.js 20+
- pnpm 9+

## Quick start

```bash
pnpm install
pnpm dev
```

## Useful commands

```bash
pnpm build
pnpm lint
pnpm start
```

## Project layout

- `apps/*` - deployable applications
- `packages/*` - shared libraries
- `config/*` - shared tooling and config

## Notes

- This repo uses Turborepo and pnpm workspaces.
- Check app-specific docs for details (for example `apps/web/README.md` and `apps/api/README.md`).
