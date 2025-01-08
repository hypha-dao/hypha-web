# Hypha Web Architecture

## Overview

Hypha Web is a modern web application built using a monorepo structure with NX as the build system. The project follows a modular architecture with clear separation of concerns between packages and applications.

## Project Structure

```
hypha-web/
├── apps/                    # Main applications
│   ├── web/                # Primary web application
│   └── web-e2e/            # End-to-end tests
├── packages/               # Shared packages and modules
│   ├── api/               # API integration and types
│   ├── cookie/            # Cookie management utilities
│   ├── epics/             # Business logic and feature implementations
│   ├── i18n/              # Internationalization support
│   ├── ui/                # Shared UI components
│   └── ui-utils/          # UI utilities and helpers
```

## Core Technologies

- **Build System**: NX
- **Package Manager**: pnpm
- **Language**: TypeScript
- **Testing**: Jest, Playwright (E2E)
- **Styling**: Tailwind CSS
- **Code Quality**: ESLint, Prettier

## Key Architectural Components

### Applications

1. **Web Application (`apps/web/`)**
   - Next.js-based main application
   - Implements the primary user interface
   - Follows the App Router pattern with [lang] internationalization support

2. **E2E Tests (`apps/web-e2e/`)**
   - Playwright-based end-to-end testing suite
   - Ensures application reliability and functionality

### Packages

1. **API Package (`packages/api/`)**
   - GraphQL integration
   - API types and interfaces
   - Query and mutation definitions

2. **UI Components (`packages/ui/`)**
   - Reusable UI components
   - Component stories and documentation
   - Shared layouts and templates

3. **UI Utilities (`packages/ui-utils/`)**
   - Theme configuration
   - Tailwind utilities
   - Common UI helpers

4. **Epics Package (`packages/epics/`)**
   - Core business logic
   - Feature implementations
   - State management

5. **Internationalization (`packages/i18n/`)**
   - Translation management
   - Language utilities
   - i18n configuration

6. **Cookie Management (`packages/cookie/`)**
   - Cookie handling utilities
   - Session management
   - Storage utilities

## Development Practices

1. **Code Organization**
   - Modular package structure
   - Clear separation of concerns
   - Shared utilities and components

2. **Quality Assurance**
   - Consistent code formatting (Prettier)
   - Static code analysis (ESLint)
   - Comprehensive testing strategy

3. **Build and Development**
   - NX workspace configuration
   - Optimized build process
   - Development environment setup

## Configuration

- TypeScript configuration in `tsconfig.base.json`
- ESLint rules in `.eslintrc.json`
- Prettier formatting in `.prettierrc`
- Environment variables managed via `.env` files

## Deployment

The project uses GitHub Actions for CI/CD, with configurations stored in the `.github/` directory.

## Best Practices

1. **Type Safety**
   - Strict TypeScript configuration
   - Proper type definitions
   - Type-safe component props

2. **Performance**
   - Optimized builds
   - Code splitting
   - Efficient state management

3. **Security**
   - Environment variable management
   - Secure API integration
   - Input validation

4. **Maintainability**
   - Consistent code style
   - Documentation
   - Modular architecture
