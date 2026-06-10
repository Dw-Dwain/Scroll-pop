# Builds and runs apps/api for Fly.io deployment.
# Mirrors the Render build: pnpm install (workspace) -> build @scrollpop/api -> run dist/index.js.
# Devdependencies are kept so `drizzle-kit migrate` can run as the Fly release_command.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate
WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @scrollpop/api build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/api/dist/index.js"]
