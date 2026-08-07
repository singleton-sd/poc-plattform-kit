# OpenAPI contract and generated API client

Nest Swagger is the **contract of record**. Consumers generate typed clients from the committed OpenAPI document — do not hand-write request/response types against the API.

## Flow

1. Decorate Nest controllers/DTOs (`@ApiProperty`, `@ApiOkResponse({ type: … })`, etc.).
2. `pnpm openapi:export` — offline Nest bootstrap writes [`packages/api-client/openapi.json`](../packages/api-client/openapi.json) (no HTTP listen).
3. `pnpm openapi:generate` — Orval emits TanStack Query + fetch hooks under `packages/api-client/src/generated/`.
4. `apps/web` depends on `@poc-plattform-kit/api-client`. `Providers` calls `configureApiClient()` (wraps `createApiClient` + `setApiClientTenantId` with `NEXT_PUBLIC_API_BASE_URL`). Tenant UI at `/tenants` uses Orval hooks; create/update fields use Zod → JSON Forms via `@poc-plattform-kit/forms`.
5. `NEXT_PUBLIC_API_BASE_URL` must be present at **Next build time** (inlined into the static export). Local: `.env` / `.env.example`. CI: `preview-web.yml` / `deploy-web.yml` set it (override with GitHub Variable `NEXT_PUBLIC_API_BASE_URL`). The API enables CORS `credentials: true` so the client’s default `credentials: 'include'` works cross-origin when the SPA origin is listed in `CORS_ORIGINS` (exact origins or `https://*.azurestaticapps.net` for SWA previews).

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm openapi:export` | Write `openapi.json` from Nest |
| `pnpm openapi:generate` | Regenerate Orval client |
| `pnpm openapi:check` | Export + generate; fail if git diff shows drift (CI) |

After API contract changes: update Swagger → `pnpm openapi:export && pnpm openapi:generate` → commit both the spec and generated sources.

**API version bumps:** Nest Swagger `info.version` is read from `apps/api/package.json`. The path-aware release script (`pnpm release:ci` / `scripts/release-changed.mjs`) re-exports and regenerates the client whenever `@poc-plattform-kit/api` is released, and includes those files in the `chore: Release package versions` commit so `pnpm openapi:check` stays green on `main`.

## Other platforms (e.g. Android)

Use the same committed file:

```bash
openapi-generator-cli generate \
  -i packages/api-client/openapi.json \
  -g kotlin \
  -o /path/to/android-client
```

(or `java`, `kotlin-spring`, etc.). No Nest/TS source required on the consumer side.
