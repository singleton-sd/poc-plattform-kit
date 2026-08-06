# Nest API image for Azure Container Apps (Consumption).
# Exposes PORT (default 3001). Build from repo root:
#   docker build -f apps/api/Dockerfile -t api-preview .
#
# Runtime packaging mirrors deploy-api.yml: `pnpm deploy --prod` so workspace
# packages (db/pillars) and generated Prisma client land in the image. Nest must
# emit flat `dist/main.js` (see tsconfig.build.json rootDir + cleared paths).

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
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
# Absolute deploy target (relative paths resolve under apps/api and mis-stage).
RUN pnpm --filter @poc-plattform-kit/api deploy --prod /out \
  && rm -rf /out/dist \
  && cp -r /app/apps/api/dist /out/dist \
  && test -f /out/dist/main.js

FROM node:20-alpine AS runner
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /out ./

USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]
