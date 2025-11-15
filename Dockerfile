FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
# RUN corepack prepare pnpm@9.* --activate

FROM base AS build
COPY . /usr/src/hypha
WORKDIR /usr/src/hypha
RUN --mount=type=cache,id=pnpm,target=pnpm/store pnpm install --prod --frozen-lockfile
RUN pnpm turbo run build
RUN pnpm deploy --filter=apps/web --prod /prod/web
RUN pnpm deploy --filter=apps/api --prod /prod/api

FROM base AS api
COPY --from=build /prod/api /prod/api
WORKDIR /prod/api
EXPOSE 3001
CMD ["pnpm", "start"]

FROM base AS web
COPY --from=build /prod/web /prod/web
WORKDIR /prod/web
EXPOSE 3000
CMD ["pnpm", "start"]
