<p align="center">
  <a href="https://hypha.earth/">
    <img src="https://hypha.earth/wp-content/themes/hypha-theme/img/round-logo.svg" height="128">
    <h1 align="center">Hypha DHO Web Platform v3</h1>
  </a>
</p>

<p align="center">
  <a aria-label="GitHub version" href="https://github.com/hypha-dao/hypha-web">
    <img alt="GitHub package.json version (subfolder of monorepo)" src="https://img.shields.io/github/package-json/v/hypha-dao/hypha-web?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="License" href="https://github.com/hypha-dao/dho-web-client/blob/master/license.md">
    <img alt="" src="https://img.shields.io/github/license/hypha-dao/dho-web-client?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="Join the community on GitHub" href="https://github.com/hypha-dao/dho-web-client/discussions">
    <img alt="Discord" src="https://img.shields.io/discord/722537361480613950?style=for-the-badge">
  </a>
</p>

# HyphaPlatform

## Architecture

### Applications

- [apps/web](./apps/web/README.md): NextJS Platform Frontend Application
- [apps/web-e2e](./apps/web-e2e/README.md): EndToEnd Testing Environment
- [apps/www](./apps/www/README.md): Public Website Application

### Packages

- [api](./packages/api/README.md): Packages to integrate relevant systems via API
- [authentication](./packages/authentication/README.md): Package that handles authentication functionality
- [cookie](./packages/cookie/README.md): Package that hosts the cookie integration
- [core](./packages/core/README.md): Core functionality and business logic
- [epics](./packages/epics/README.md): Package for managing epics functionality
- [feature-flags](./packages/feature-flags/README.md): Package for managing feature flags
- [i18n](./packages/i18n/README.md): Package that hosts the internationalisation configuration and helpers
- [model](./packages/model/README.md): Data models and type definitions
- [storage-evm](./packages/storage-evm/README.md): EVM storage implementation
- [storage-postgres](./packages/storage-postgres/README.md): PostgreSQL storage implementation
- [tools](./packages/tools/README.md): Utility tools and helpers
- [ui](./packages/ui/README.md): Package that hosts the UI component library
- [ui-utils](./packages/ui-utils/README.md): Package that hosts UI utility functions and helpers

## Local Development

### Setup Database

**Start the database (requires Docker to be installed)**

```bash
npx nx run storage-postgres:db:start
```

**Run migrations**

```bash
npx nx run storage-postgres:migrate
```

**Seed the database**

```bash
npx nx run storage-postgres:seed
```

**Start the development server**

```bash
npx nx run web:dev:local
```

### Running Tests

To run tests for affected projects:

```bash
npx nx affected -t test --parallel=1
```

Note: We use `--parallel=1` to ensure proper database isolation between tests.

### Database Development Tools

This project includes the VSCode Drizzle ORM extension which provides convenient database development tools:

- **Drizzle Visualizer**: Opens a visual representation of your database schema. Access it by clicking "Open Drizzle Visualizer" in any `drizzle.config.ts` file.
- **Drizzle Studio**: A GUI for viewing and managing your database data. Access it by clicking "Open Drizzle Studio" in any `drizzle.config.ts` file.

Both tools open as tabs directly in your VSCode editor for a seamless development experience.

## Build for production

Run `pnpm run build` to build the application. The build artifacts are stored in the output directory (e.g. `dist/` or `build/`), ready to be deployed.

## Running arbitrary tasks within different packages

To execute tasks with Nx use the following syntax:

```
npx nx <target> <project> <...options>
```

You can also run multiple targets:

```
npx nx run-many -t <target1> <target2>
```

..or add `-p` to filter specific projects

```
npx nx run-many -t <target1> <target2> -p <proj1> <proj2>
```

Targets can be defined in the `package.json` or `projects.json`. Learn more [in the docs](https://nx.dev/features/run-tasks).

## Explore the project graph

Run `npx nx graph` to show the graph of the workspace.
It will show tasks that you can run with Nx.

- [Learn more about Exploring the Project Graph](https://nx.dev/core-features/explore-graph)

## Integrate this nx.dev workspace with editors

Enhance your Nx experience by installing [Nx Console](https://nx.dev/nx-console) for your favorite editor. Nx Console
provides an interactive UI to view your projects, run tasks, generate code, and more! Available for VSCode, IntelliJ and
comes with a LSP for Vim users.

## Contributors

<a href="https://github.com/hypha-dao/hypha-web/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=hypha-dao/hypha-web&max=100&columns=20" alt="hypha platform v3 contributors" />
</a>
