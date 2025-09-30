# -----------------------
# STAGE 1: Build the API
# -----------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy all necessary files for building
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY migrations.json ./
COPY nx.json ./
COPY tsconfig.base.json ./
COPY vitest.workspace.ts ./
COPY .prettierrc ./
COPY .prettierignore ./
COPY components.json ./
COPY eslint.config.mjs ./
COPY jest.config.ts ./
COPY jest.preset.js ./

# Copy source files (only what's needed)
COPY apps/api ./apps/api
COPY packages ./packages

# Install all dependencies (including dev) with pnpm workspaces
RUN pnpm install --frozen-lockfile

# RUN npx nx run api:generate-types
RUN npx openapi-typescript-codegen --input apps/api/docs/v1/openapi.yaml --output apps/api/src/types/v1/generated --client fetch

# Build the API using esbuild through Nx
RUN npx nx run api:build:min

# -------------------------------
# STAGE 2: Slim Production Image
# -------------------------------
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only the files needed to install prod deps
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY .env ./
COPY --from=builder /app/apps/api/docs ./docs

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy only the built output from builder
COPY --from=builder /app/apps/api/dist ./api

# Expose the port your API uses (adjust if needed)
EXPOSE 3001

# Start the api app server
CMD ["node", "api/server.js"]
