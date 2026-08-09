# Nest API image for Azure Container Apps (Consumption) — PREVIEW ONLY.
# Exposes PORT (default 3001). Build from repo root:
#   docker build -f apps/api/Dockerfile -t api-preview .
#
# Production/App Service deploys use scripts/stage-api-deploy.sh (zip
# deploy), never this Dockerfile, and always generate the canonical SQL
# Server Prisma client from prisma/schema.prisma unchanged.
#
# This image instead derives a SQLite-compatible preview schema at build
# time (scripts/generate-preview-schema.mjs), generates a SQLite Prisma
# client from it, and materialises an immutable, seeded-empty SQLite
# database template baked into the image. docker-entrypoint.sh copies that
# template to a writable runtime path on every container start, so a
# preview never resolves or mutates the shared Azure SQL database — see
# AGENTS.md and docs/preview-scenarios.md.
#
# Runtime packaging otherwise mirrors scripts/stage-api-deploy.sh:
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

# Derive the SQLite preview schema from the canonical SQL Server schema.
# Fails the build with an actionable diagnostic (not a silently broken
# preview) when the canonical schema uses a construct the SQLite connector
# can't represent.
RUN node /app/packages/db/scripts/generate-preview-schema.mjs \
      /app/packages/db/prisma/schema.prisma \
      /app/packages/db/prisma/schema.preview.prisma

# Match App Service staging shape (hoisted deploy tree), but generate a
# SQLite client + an immutable SQLite database template instead of the SQL
# Server client production deploys use.
# Resolve prisma via node (pnpm .bin shims can vanish after re-linking for deploy).
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
  && test -f /out/prisma/preview-template.db \
  && DATABASE_URL="file:/out/prisma/preview-template.db" node -e "\
      const { PrismaClient } = require('@prisma/client'); \
      const p = new PrismaClient(); \
      p.tenant.findMany().then((rows) => { \
        console.log('prisma sqlite preview template ok, tenant rows:', rows.length); \
        return p.\$disconnect(); \
      }).catch((e) => { console.error(e); process.exit(1); });"

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl \
  && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /out ./
COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /app/data \
  && chown app:app /app/data \
  && chmod 0444 /app/prisma/preview-template.db

USER app
EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
