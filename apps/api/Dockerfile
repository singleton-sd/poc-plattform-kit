# Nest API image for Azure Container Apps (Consumption).
# Exposes PORT (default 3001). Build from repo root:
#   docker build -f apps/api/Dockerfile -t api-preview .
#
# Runtime packaging mirrors scripts/stage-api-deploy.sh:
#   - hoisted pnpm deploy --prod
#   - copy flat dist/main.js (tsconfig.build.json rootDir + cleared paths)
#   - prisma generate into the deploy tree (deploy's node_modules is a stub)

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
# Match App Service staging: hoisted deploy tree + generate into /out.
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
  && cp /app/packages/db/prisma/schema.prisma /out/prisma/schema.prisma \
  && cd /out \
  && DATABASE_URL="sqlserver://localhost:1433;database=ci;user=ci;password=ci;encrypt=true;trustServerCertificate=true" \
     node "$PRISMA_JS" generate --schema=/out/prisma/schema.prisma \
  && node -e "const {PrismaClient}=require('@prisma/client'); new PrismaClient(); console.log('prisma generate ok')"

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl \
  && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /out ./

USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]
