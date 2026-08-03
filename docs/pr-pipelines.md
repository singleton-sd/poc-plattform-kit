# PR pipelines & preview environments

`[repo=singleton-sd/poc-plattform-kit]`

## Path filters (FE / BE split)

| Workflow | Triggers when paths change | Checks |
| --- | --- | --- |
| `ci.yml` (current) / `ci-web.yml` + `ci-api.yml` (PR #3) | see paths in each workflow | lint, test, build |
| `preview-web.yml` | `apps/web/**`, `packages/**` | SWA **PR preview** (Free) — when enabled |
| `preview-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | **Container Apps** ephemeral preview (Consumption) |

Branch naming stays `feature/<clickup-task-id>-<kebab-title>`. Humans only merge to `main`.

## Preview strategy (locked)

### FE — SWA Free PR previews (unchanged)

Azure Static Web Apps **Free** includes PR preview environments via `preview-web.yml` (see open CI PR if not yet on `main`).

**GitHub secret:** `AZURE_STATIC_WEB_APPS_API_TOKEN` from SWA `pocpk-web-si5fhs6dvxiha`.

### BE — Container Apps per PR (Path B — locked)

Each API PR gets its own preview URL via **Azure Container Apps Consumption** (scale to zero).

| Option | Cost / behaviour | Status |
| --- | --- | --- |
| **Path B (locked)** | ACA Consumption + ACR Basic; ephemeral `ssd-pocpk-aca-pr-<n>-ae` | **Use this** |
| Shared F1 overwrite | One app, last PR wins | **Rejected** for per-PR need |
| App Service S1 slots | Expensive for PoC | **Deprecated** |
| Path A (CI-only stub) | No live URL | Superseded by Path B |

#### Resources (CAF)

| Resource | Name | SKU / notes |
| --- | --- | --- |
| Container Apps Environment | `ssd-pocpk-cae-dev-ae` | Consumption; Log Analytics `ssd-pocpk-law-dev-ae` |
| ACR | `ssdpocpkacrdevae` | **Basic**; alphanumeric-only (CAF without hyphens) |
| Ephemeral app | `ssd-pocpk-aca-pr-<n>-ae` | max 32 chars; min replicas 0 |
| Optional base app | `ssd-pocpk-aca-api-dev-ae` | off by default |

Provision once:

```powershell
az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
powershell -File ./infra/deploy-aca-preview.ps1
```

KV secrets (names only): `acr-admin-username`, `acr-admin-password`, `acr-login-server`.

#### Workflow behaviour (`preview-api.yml`)

1. **PR open/sync** (paths `apps/api/**`, `pillars/**`, `packages/**`): build `apps/api/Dockerfile`, push `…/pocpk-api:pr-<n>`, create/update Container App, comment preview URL (`/health`).
2. **PR close:** delete `ssd-pocpk-aca-pr-<n>-ae`.

#### GitHub Azure auth (human)

**OIDC only** (`AZURE_CREDENTIALS` / SP-JSON is not supported):

1. Entra app + federated credential for `repo:singleton-sd/poc-plattform-kit:pull_request`.
2. RBAC: Contributor on `rg-poc-plattform-kit`, AcrPush on `ssdpocpkacrdevae`, Key Vault Secrets User on `ssd-pocpk-kv-dev-ae`.
3. Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` (`9a0e57d7-e58e-4e8b-814d-037cd7d9015c`), `AZURE_SUBSCRIPTION_ID` (`7b8343d7-969f-4b71-8864-b7925e7fae30`).
4. Workflow fails fast if any OIDC secret is missing.

Nest listens on `PORT` (default `3001` in the image / ACA env). Health: `/health`.
