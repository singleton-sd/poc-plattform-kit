# Preview-only static export for Azure Container Apps Consumption.
# Do not use this image for production (production stays SWA Free via
# deploy-web.yml).
#
# Build from the repository root:
#   docker build -f apps/web/Dockerfile -t pocpk-web \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example \
#     --build-arg NEXT_PUBLIC_AZURE_AD_CLIENT_ID= \
#     --build-arg NEXT_PUBLIC_AZURE_AD_TENANT_ID= \
#     --build-arg NEXT_PUBLIC_AZURE_AD_API_SCOPE= .
#
# Workflows pass NEXT_PUBLIC_* build-args so Next inlines them at build time
# (same contract as preview-web.yml today). Listen port is $PORT (default 80).

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY apps/marketing/package.json ./apps/marketing/
COPY apps/marketing-oauth/package.json ./apps/marketing-oauth/
COPY packages ./packages
COPY pillars ./pillars
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/web ./apps/web
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_AZURE_AD_CLIENT_ID=
ARG NEXT_PUBLIC_AZURE_AD_TENANT_ID=
ARG NEXT_PUBLIC_AZURE_AD_API_SCOPE=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_AZURE_AD_CLIENT_ID=$NEXT_PUBLIC_AZURE_AD_CLIENT_ID \
    NEXT_PUBLIC_AZURE_AD_TENANT_ID=$NEXT_PUBLIC_AZURE_AD_TENANT_ID \
    NEXT_PUBLIC_AZURE_AD_API_SCOPE=$NEXT_PUBLIC_AZURE_AD_API_SCOPE
RUN pnpm --filter @poc-plattform-kit/web... run build \
 && test -f /app/apps/web/out/index.html

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/out /usr/share/nginx/html
ENV PORT=80
EXPOSE 80
# PORT is substituted at start so ACA can set targetPort without rebuilding.
CMD ["/bin/sh", "-c", "sed -i \"s/listen 80;/listen ${PORT:-80};/\" /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
