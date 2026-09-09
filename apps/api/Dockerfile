# Nest API image for Azure Container Apps (Consumption).
# Build from repo root. Two targets share the same Dockerfile:
#
#   Production (Neon PostgreSQL Prisma client):
#     docker build -f apps/api/Dockerfile --target production -t pocpk-api:local .
#
#   PR preview (SQLite template + reset entrypoint):
#     docker build -f apps/api/Dockerfile --target preview -t api-preview \
#       --build-arg PREVIEW_SEED_SCENARIOS=demo .
#
# Default final stage is `preview` so accidental untagged builds never ship a
# production image missing the SQLite isolation path. Production deploys must
# pass --target production.
#
# Runtime packaging mirrors scripts/stage-api-deploy.sh:
#   - hoisted pnpm deploy --prod
#   - copy flat dist/main.js (tsconfig.build.json rootDir + cleared paths)

FROM node:20-alpine AS base
RUN apk add --no-cache openssl \
  && corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages
COPY pillars ./pillars
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api ./apps/api
RUN pnpm --filter @poc-plattform-kit/api build

# ---------------------------------------------------------------------------
# Production package — canonical PostgreSQL Prisma client (Neon at runtime)
# ---------------------------------------------------------------------------
FROM build AS prod-package
RUN PRISMA_JS="$(find /app/node_modules -path '*/node_modules/prisma/build/index.js' | head -n 1)" \
  && test -n "$PRISMA_JS" \
  && printf '%s\n' \
      'inject-workspace-packages=true' \
      'node-linker=hoisted' \
      'shamefully-hoist=true' \
      > /app/.npmrc \
  && pnpm --filter @poc-plattform-kit/api deploy --prod /out \
  && rm -rf /out/dist \
  && cp -r /app/apps/api/dist /out/dist \
  && test -f /out/dist/main.js \
  && mkdir -p /out/prisma \
  && cp /app/packages/db/prisma/schema.prisma /out/prisma/schema.prisma \
  && node /app/packages/db/scripts/pin-generator-output.mjs \
      /out/prisma/schema.prisma \
      ../node_modules/.prisma/client \
  && cd /out \
  && DATABASE_URL="postgresql://ci:ci@localhost:5432/ci?schema=public" \
     DATABASE_URL_UNPOOLED="postgresql://ci:ci@localhost:5432/ci?schema=public" \
     node "$PRISMA_JS" generate --schema=/out/prisma/schema.prisma \
  && test -f /out/node_modules/.prisma/client/index.js

FROM node:20-alpine AS production
RUN apk add --no-cache openssl \
  && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=prod-package /out ./
USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# Preview package — SQLite template baked in; never the shared Neon database
# ---------------------------------------------------------------------------
FROM build AS preview-package
ARG PREVIEW_SEED_SCENARIOS=demo
RUN node /app/packages/db/scripts/generate-preview-schema.mjs \
      /app/packages/db/prisma/schema.prisma \
      /app/packages/db/prisma/schema.preview.prisma
RUN PRISMA_JS="$(find /app/node_modules -path '*/node_modules/prisma/build/index.js' | head -n 1)" \
  && test -n "$PRISMA_JS" \
  && printf '%s\n' \
      'inject-workspace-packages=true' \
      'node-linker=hoisted' \
      'shamefully-hoist=true' \
      > /app/.npmrc \
  && pnpm --filter @poc-plattform-kit/api deploy --prod /out \
  && rm -rf /out/dist \
  && cp -r /app/apps/api/dist /out/dist \
  && test -f /out/dist/main.js \
  && mkdir -p /out/prisma \
  && cp /app/packages/db/prisma/schema.preview.prisma /out/prisma/schema.preview.prisma \
  && node /app/packages/db/scripts/pin-generator-output.mjs \
      /out/prisma/schema.preview.prisma \
      ../node_modules/.prisma/client \
  && cd /out \
  && DATABASE_URL="file:/out/prisma/preview-template.db" \
     node "$PRISMA_JS" db push --schema=/out/prisma/schema.preview.prisma --skip-generate --accept-data-loss \
  && DATABASE_URL="file:/out/prisma/preview-template.db" \
     node "$PRISMA_JS" generate --schema=/out/prisma/schema.preview.prisma \
  && test -f /out/node_modules/.prisma/client/index.js \
  && node /app/packages/db/scripts/seed.mjs \
       --scenarios="$PREVIEW_SEED_SCENARIOS" \
       --database-url="file:/out/prisma/preview-template.db" \
       --client=/out/node_modules/.prisma/client \
  && test -f /out/prisma/preview-template.db \
  && printf '%s' "$PREVIEW_SEED_SCENARIOS" > /out/prisma/preview-scenarios.txt \
  && mkdir -p /out/preview-scripts \
  && cp -r /app/packages/db/scripts /out/preview-scripts/db-scripts

FROM node:20-alpine AS preview
RUN apk add --no-cache openssl \
  && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=preview-package /out ./
COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /app/data \
  && chown app:app /app/data \
  && chmod 0444 /app/prisma/preview-template.db
USER app
EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
