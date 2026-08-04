# PR pipelines & preview environments

`[repo=singleton-sd/poc-plattform-kit]`

## Path filters (FE / BE split)

| Workflow | Triggers when paths change | Checks |
| --- | --- | --- |
| `ci-web.yml` | `apps/web/**`, `packages/**` | prettier check, lint, build, test (web + packages) |
| `ci-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | prettier check, lint, test, build (api + pillars + packages) |
| `preview-web.yml` | `apps/web/**`, `packages/**` | SWA **PR preview** (Free) via OIDC → Key Vault |
| `preview-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | **Container Apps** ephemeral preview (Consumption) |

**Shared packages:** changes under `packages/**` run **both** `ci-web` and `ci-api`. FE-only PRs skip API CI; API/pillar-only PRs skip web CI.

Branch naming stays `feature/<clickup-task-id>-<kebab-title>`. Humans only merge to `main`. Solo-repo: require CI checks, **not** approving reviews (see `SETUP.md`).

## Secrets / config for pipelines (locked)

| Allowed in GitHub | Forbidden in GitHub |
| --- | --- |
| Variables: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (IDs) | Any secret: SWA deploy token, connection strings, passwords, client secrets, ACR admin, `AZURE_CREDENTIALS` |
| Built-in `GITHUB_TOKEN` for PR comments | `AZURE_STATIC_WEB_APPS_API_TOKEN` or similar |

Flow: **Azure Login (OIDC)** → `az keyvault secret show` / App Config → use value only as a **job env var** (mask in logs; never a GitHub Secret).

If OIDC Variables are missing, `preview-web.yml` **skips** deploy/close (job succeeds). `preview-api.yml` **fails fast** with a clear error until Variables + RBAC are configured.

### OIDC subject forms (Entra FIC)

GitHub may emit **ID-form** OIDC subjects such as `repo:ORG@ORG_ID/REPO@REPO_ID:pull_request` (and the matching `:ref:refs/heads/main` form). The Entra federated identity credential **subject must match that `sub` claim exactly**. Classic subjects (`repo:org/repo:pull_request`) can remain on the app registration for compatibility when tokens still use them.

Both preview workflows use `azure/login@v2` with job `permissions.id-token: write` for OIDC.

### Node version

CI/preview workflows use **Node 24**. Prefer upgrading actions over setting `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` (only if forced by an unupgradable action).

Secrets live in **Key Vault** `ssd-pocpk-kv-dev-ae`. Non-secret config + KV refs live in **App Configuration** `ssd-pocpk-appcs-dev-ae`.

## Preview strategy (locked)

### FE — SWA Free PR previews

Azure Static Web Apps **Free** includes PR preview environments.

- Workflow: `.github/workflows/preview-web.yml`
- Action: `Azure/static-web-apps-deploy@v1`
- App location: `apps/web/out` (Next.js static export; workflow builds first)
- Token: Key Vault secret `swa-deployment-token` (populated from `az staticwebapp secrets list`; never committed; never a GitHub secret)

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

1. Entra app + federated credential for `repo:singleton-sd/poc-plattform-kit:pull_request` (and ID-form subject if tokens use it).
2. RBAC: Contributor on `rg-poc-plattform-kit`, AcrPush on `ssdpocpkacrdevae`, Key Vault Secrets User on `ssd-pocpk-kv-dev-ae`.
3. Repository **Variables** (not Secrets): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
4. Workflow fails fast if any OIDC Variable is missing.

Nest listens on `PORT` (default `3001` in the image / ACA env). Health: `/health`.

## Root scripts

```bash
pnpm format:check   # Prettier
pnpm format
pnpm lint           # package stubs + root ESLint
pnpm test
pnpm build
```
