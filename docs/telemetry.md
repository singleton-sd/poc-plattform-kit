# Telemetry / Observability

This file is the authoritative technical reference for telemetry/observability
(see [`docs/github-source-of-truth.md`](./github-source-of-truth.md) section 1 —
repository documentation, not ClickUp, owns engineering technical knowledge).
Update this file directly; do not require ClickUp access to understand or
change telemetry behavior. The historical ClickUp Architecture Doc page this
was originally drafted from (business framing/origin only, not kept in sync)
is linked for traceability:
[ClickUp Architecture Doc — Telemetry / Observability](https://app.clickup.com/90161394355/docs/2kz0kcnk-1416/2kz0kcnk-2836).

## Goal

Detect BE and FE errors, emit structured logs, and email when exceptions or failed requests spike.

## Azure resources (CAF)

| Resource | Name | SKU |
| --- | --- | --- |
| Log Analytics | `ssd-pocpk-law-dev-ae` | PerGB2018, 30-day retention |
| Application Insights | `ssd-pocpk-appi-dev-ae` | Workspace-based |
| Action group | `ssd-pocpk-ag-errors-dev-ae` | Email (`alertEmail` Bicep param) |

Alerts (when `alertEmail` is set on deploy):

| Alert | Signal | Threshold |
| --- | --- | --- |
| `ssd-pocpk-alert-exceptions-dev-ae` | `exceptions` last 15m | ≥ 1 |
| `ssd-pocpk-alert-failed-requests-dev-ae` | failed `requests` last 15m | ≥ 5 |

## Where to log

| Concern | Where | How |
| --- | --- | --- |
| Traces / exceptions / dependencies | Application Insights | API: `@azure/monitor-opentelemetry`; Web: `apps/web/public/telemetry.js` + `@poc-plattform-kit/web/telemetry` |
| Structured logs | stdout → App Insights / LAW | `nestjs-pino` (`cloudRoleName=api`) |
| Domain audit | Pillar DB Audit + Outbox | **Not** APM |
| Connection string | Key Vault `appinsights-connection-string` | App Config `secret:appinsights-connection-string`; App Service `APPLICATIONINSIGHTS_CONNECTION_STRING` |

### API bootstrap order

1. Env / App Config loaded  
2. `import './telemetry'` → `useAzureMonitor()` when connection string present  
3. Nest + Pino + correlation middleware + `AllExceptionsFilter`

### Web

- Stub: `/telemetry.js` initializes when connection string is in meta tag or `window.__APP_INSIGHTS_CONNECTION_STRING__`
- Future Next.js: import `@poc-plattform-kit/web/telemetry` and `reportBoundaryError` from error boundaries

### Conventions

- Always: `correlationId` / `traceparent`, `tenantId` when known, role name `api` or `web`
- Never: passwords, tokens, connection strings, raw PII in logs

## Local

```powershell
# Optional — without this, API skips OTel and pretty-prints Pino
$env:APPLICATIONINSIGHTS_CONNECTION_STRING = (az keyvault secret show --vault-name ssd-pocpk-kv-dev-ae --name appinsights-connection-string --query value -o tsv)
pnpm --filter @poc-plattform-kit/api test
pnpm --filter @poc-plattform-kit/api start:dev
```

Deploy alerts:

```powershell
./infra/deploy.sh --alert-email you@example.com
```

Pass `alertEmail` via:

```powershell
az deployment group create ... --parameters alertEmail=you@example.com
```

(or pass `--alert-email` to `./infra/deploy.sh`).

## Out of scope / phase 2

Teams webhook, SQL deadlock alerts, full APM dashboards, Sentry.
