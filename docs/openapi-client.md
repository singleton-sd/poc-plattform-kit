# OpenAPI contract and generated API client

Nest Swagger is the **contract of record**. Consumers generate typed clients from the committed OpenAPI document — do not hand-write request/response types against the API.

## Flow

1. Decorate Nest controllers/DTOs (`@ApiProperty`, `@ApiOkResponse({ type: … })`, etc.).
2. `pnpm openapi:export` — offline Nest bootstrap writes [`packages/api-client/openapi.json`](../packages/api-client/openapi.json) (no HTTP listen).
3. `pnpm openapi:generate` — Orval emits TanStack Query + fetch hooks under `packages/api-client/src/generated/`.
4. `apps/web` depends on `@poc-plattform-kit/api-client`. Call `createApiClient({ baseUrl, headers })` once at app startup.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm openapi:export` | Write `openapi.json` from Nest |
| `pnpm openapi:generate` | Regenerate Orval client |
| `pnpm openapi:check` | Export + generate; fail if git diff shows drift (CI) |

After API contract changes: update Swagger → `pnpm openapi:export && pnpm openapi:generate` → commit both the spec and generated sources.

## Other platforms (e.g. Android)

Use the same committed file:

```bash
openapi-generator-cli generate \
  -i packages/api-client/openapi.json \
  -g kotlin \
  -o /path/to/android-client
```

(or `java`, `kotlin-spring`, etc.). No Nest/TS source required on the consumer side.
