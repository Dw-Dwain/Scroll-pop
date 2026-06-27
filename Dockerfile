# Builds and runs apps/api for Fly.io deployment.
# Mirrors the Render build: pnpm install (workspace) -> build @scrollpop/api -> run dist/index.js.
#
# Devdependencies are intentionally KEPT in the final image: the Fly release_command runs
# `drizzle-kit migrate`, which lives in devDependencies. A `--prod` prune would remove it and
# break migrations, so the security hardening here is RUNTIME PRIVILEGE (H-5) rather than a
# minimal-deps multi-stage prune:
#   - the process drops from root (UID 0) to a dedicated unprivileged `app` user;
#   - the build still happens as root (corepack/pnpm need to write the store), then ownership
#     of /app is handed to `app` before we switch users.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

# Create the unprivileged runtime user up front so we can chown into it.
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @scrollpop/api build

# Hand the whole working tree (node_modules + dist + drizzle migrations) to the runtime user
# so it can read everything it needs without write access to anything it shouldn't.
RUN chown -R app:app /app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Drop privileges: the API (and the release_command's drizzle-kit migrate) run as non-root.
USER app

CMD ["node", "apps/api/dist/index.js"]
