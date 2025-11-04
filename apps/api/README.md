# Hypha API

This is the **backend API service** for the Hypha Mobile project, built with Fastify and TypeScript, bundled using Esbuild and managed with the Nx monorepo toolkit.

---

## 🔧 Tech Stack

- **Language**: TypeScript
- **Framework**: [Fastify](https://fastify.dev/)
- **API Documentation**: OpenAPI (Swagger)
- **Bundler**: [esbuild](https://esbuild.github.io/)
- **Monorepo Tooling**: [Nx](https://nx.dev/)
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Containerization**: Docker + Docker Compose

---

## 💠 Build Commands

This project uses custom Nx targets defined in `apps/api/project.json`.

### 📁 `project.json` Highlights

| Target           | What it does                                |
| ---------------- | ------------------------------------------- |
| `build`          | Standard TypeScript build using `tsc`       |
| `build:min`      | Production build using `esbuild` (minified) |
| `dev`            | Run the app with live reload (via `tsx`)    |
| `generate-types` | Regenerates OpenAPI types from YAML spec    |

Example usage:

```bash
npx nx run api:build:min
npx nx run api:dev
```

---

## 🐳 Docker Setup

This app includes a multistage Dockerfile to produce a slim, production-ready container.

### Build and run with Docker Compose:

From the **monorepo root**:

```bash
docker compose up -d --build
```

This will:

- Build the app using `esbuild` via Nx
- Copy runtime dependencies only
- Copy the `docs/v1/openapi.yaml` spec file into the final container
- Expose the API on port `3001`

### Stop and remove containers:

```bash
docker compose down
```

---

## 🔍 Accessing the API

- **API Base URL**: [http://localhost:3001/api/v1](http://localhost:3001/api/v1)
- **Swagger UI**: [http://localhost:3001/v1/docs](http://localhost:3001/v1/docs)

> ⚠️ Routes are defined manually inside `apps/api/src/routes`. They are **not** auto-generated from the OpenAPI spec.
>
> The OpenAPI YAML file located at `apps/api/docs/v1/openapi.yaml` is only used to generate **TypeScript types** consumed within route handlers and other parts of the app.

---

## ⚠️ External Files

This project depends on some files that must be available at runtime:

- `apps/api/docs/v1/openapi.yaml` — Required by Swagger UI
- `.env` and `.env.template` — Environment variable configuration

In the Dockerfile, these are copied to the appropriate paths:

- The `docs/` folder is copied to `/app/docs`
- `.env` and `.env.template` are copied to `/app`

---

## ⚙️ Production Build Notes

- Uses `esbuild` for fast builds and bundling into a single file (`dist/server.js`)
- Certain Fastify plugins (e.g., `@fastify/swagger-ui`) require dynamic loading
  - These are preserved using esbuild’s `--external` option
- To avoid breaking file system access (e.g., YAML loading), runtime paths use `process.cwd()` and relative resolution

---

## 📜 Example Nx Targets in `project.json`

```json
"build:min": {
  "executor": "nx:run-commands",
  "options": {
    "commands": [
      {
        "command": "esbuild apps/api/src/server.ts --bundle --minify --platform=node --external:@fastify/swagger --external:@fastify/swagger-ui --outfile=dist/server.js"
      }
    ],
    "cwd": "apps/api"
  }
}
```

---

## 🚀 Future Improvements

-

---

## 🔪 Running without Docker

You can also run the API locally without Docker:

```bash
pnpm install
npx nx run api:dev
```

Make sure you have:

- A valid `.env` file
- The OpenAPI YAML file in `apps/api/docs/v1/openapi.yaml`

---

## ✅ TL;DR – To Run It All

**With Docker Compose:**

```bash
docker compose up -d --build
```

Then visit:

- [http://localhost:3001/api/v1](http://localhost:3001/api/v1)
- [http://localhost:3001/v1/docs](http://localhost:3001/v1/docs)

**With Nx (local):**

```bash
pnpm install
npx nx run api:dev
```


