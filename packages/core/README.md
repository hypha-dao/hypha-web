# @hypha-platform/core

Core package for Hypha platform that handles:

- Dependency injection
- Storage configuration
- Repository factory
- Context management

## Structure

```
src/
  ├── config/         # Configuration management
  ├── container/      # DI container
  ├── factory/        # Repository factories
  └── context/        # Context management
```

### Service Repository Pattern

```mermaid
flowchart TD
    WebApp --> ServerActions
    MobileApp --> API

    ServerActions --> PeopleService
    ServerActions --> SpaceService
    ServerActions --> DocumentService

    API --> PeopleService
    API --> SpaceService
    API --> DocumentService

    PeopleService --> PeopleRepoPostgres
    PeopleService --> PeopleRepoEvm
    SpaceService --> SpaceRepoPostgres
    SpaceService --> SpaceRepoEVM
    DocumentService --> DocumentRepoPostgres
    DocumentService --> DocumentRepoEvm

    PeopleRepoPostgres --> A
    SpaceRepoPostgres --> A
    DocumentRepoPostgres --> A
    PeopleRepoEvm --> B
    SpaceRepoEVM --> B
    DocumentRepoEvm --> B
    A@{ shape: cyl, label: "PostgreSQL" }
    B@{ shape: cyl, label: "SmartContracts" }
```

## Usage

```typescript
import { Container, CoreConfig } from '@hypha-platform/core';

// Configure storage
const config: CoreConfig = {
  storage: {
    space: 'postgres',
    agreement: 'postgres',
    member: 'memory',
    comment: 'memory',
  },
};

// Use in your application
const container = createContainer(config);
const spaceRepo = container.get(Tokens.SpaceRepository);
```
