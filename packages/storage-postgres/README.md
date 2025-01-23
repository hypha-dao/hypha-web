# @hypha-platform/storage-postgres

PostgreSQL storage implementation for Hypha platform.

## Structure

```
src/
  ├── schema/         # Drizzle schema definitions
  ├── migrations/     # Generated migrations
  ├── repositories/   # Repository implementations
  └── client.ts       # Database client
```

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Set up your database:

```bash
# Create database
createdb hypha

# Generate migrations
pnpm generate

# Run migrations
pnpm migrate
```

## Usage

```typescript
import { PostgresSpaceRepository } from '@hypha-platform/storage-postgres';

const spaceRepo = new PostgresSpaceRepository();
const spaces = await spaceRepo.list();
```

## Development

- Add new schemas in `src/schema/`
- Generate migrations after schema changes:

```bash
pnpm generate
```

- Run migrations:

```bash
pnpm migrate
```
