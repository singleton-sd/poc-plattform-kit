# Nest API image for Azure Container Apps (Consumption).
# Exposes PORT (default 3001). Build from repo root:
#   docker build -f apps/api/Dockerfile -t api-preview .
#
# Multi-stage pnpm monorepo build. Keep the final image small (Alpine + prod deps).

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages
COPY pillars ./pillars
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api ./apps/api
RUN pnpm --filter @poc-plattform-kit/api build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
  && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages
COPY pillars ./pillars
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/apps/api/dist ./apps/api/dist

USER app
EXPOSE 3001
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
