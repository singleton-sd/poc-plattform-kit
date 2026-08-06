# PR pipelines & preview environments

`[repo=singleton-sd/poc-plattform-kit]`

## Path filters (FE / BE split)

| Workflow | Triggers when paths change | Checks |
| --- | --- | --- |
| `ci-web.yml` | `apps/web/**`, `apps/marketing/**`, `packages/**` | prettier check, lint, build, test (web + marketing + packages) |
| `ci-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | prettier check, lint, test, build (api + pillars + packages) |
| `preview-web.yml` | `apps/web/**`, `packages/**` | SWA **PR preview** (Free) via OIDC → Key Vault |
| `preview-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | **Container Apps** ephemeral preview (Consumption) |
| `deploy-web.yml` | `apps/web/**`, `packages/**` on **`main`** | SWA **production** via OIDC → Key Vault |
| `deploy-marketing.yml` | `apps/marketing/**` on **`main`** | Marketing SWA **production** via OIDC → Key Vault |
| `deploy-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` on **`main`** | Nest zip → App Service **B1** via OIDC |

**Shared packages:** changes under `packages/**` run **both** `ci-web` and `ci-api`. FE-only PRs skip API CI; API/pillar-only PRs skip web CI. Push to `main` with the same paths also runs the matching **deploy-*** workflow.

Branch naming stays `feature/<clickup-task-id>-<kebab-title>`. Humans only merge to `main`. Solo-repo: require CI checks, **not** approving reviews (see `SETUP.md`).

## Secrets / config for pipelines (locked)

| Allowed in GitHub | Forbidden in GitHub |
| --- | --- |
| Variables: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (IDs) | Any secret: SWA deploy token, connection strings, passwords, client secrets, ACR admin, `AZURE_CREDENTIALS` |
| Built-in `GITHUB_TOKEN` for PR comments | `AZURE_STATIC_WEB_APPS_API_TOKEN` or similar |

Flow: **Azure Login (OIDC)** → `az keyvault secret show` / App Config → use value only as a **job env var** (mask in logs; never a GitHub Secret).

If OIDC Variables are missing, `preview-web.yml` / `deploy-web.yml` / `deploy-api.yml` **skip** deploy (job succeeds) so CI is not blocked forever. `preview-api.yml` **fails fast** with a clear error until Variables + RBAC are configured.

`deploy-api.yml` also needs the OIDC app registration (`ssd-pocpk-gha-oidc-dev`) to have **Website Contributor** on `pocpk-api-si5fhs6dvxiha` (SWA production uses the KV deploy token only).

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
2. RBAC: Contributor on `rg-poc-plattform-kit`, Key Vault Secrets User on `ssd-pocpk-kv-dev-ae` (ACR admin secrets already in KV from `deploy-aca-preview.ps1`).
3. Repository **Variables** (not Secrets): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
4. Workflow fails fast if any OIDC Variable is missing.
5. Image push + ACA registry attach use OIDC → KV `acr-admin-*` (never GitHub Secrets / `AZURE_CREDENTIALS`).

Nest listens on `PORT` (default `3001` in the image / ACA env). Health: `/health`.

## Production deploy on `main` (locked)

| Workflow | Host | Auth |
| --- | --- | --- |
| `deploy-web.yml` | SWA Free production (`kind-rock-0f409fe00.7.azurestaticapps.net`) | OIDC → KV `swa-deployment-token` |
| `deploy-api.yml` | App Service (`pocpk-api-si5fhs6dvxiha.azurewebsites.net`) | OIDC → `az webapp deploy --type zip` (needs **Website Contributor**) |

- Triggers: `push` to `main` with the same path filters as CI/preview; `deploy-api.yml` also supports `workflow_dispatch`.
- Builds in the job (web → `apps/web/out`; API → staged `.deploy/api` with `dist/` + prod `node_modules`).
- API startup: `node dist/main.js` (set each deploy; staged `package.json` `"start"` matches).
- **API must not Oryx-build on App Service:** keep `SCM_DO_BUILD_DURING_DEPLOYMENT=false` and `ENABLE_ORYX_BUILD=false` in Bicep / app settings (set once — **not** in the deploy job). Mutating app settings right before zip restarts SCM and aborts OneDeploy. `deploy-api.yml` runs [`scripts/stage-api-deploy.sh --kudu`](../scripts/stage-api-deploy.sh) then `az webapp deploy --type zip --async true --track-status false` (absolute deploy dir + `node-linker=hoisted` + `prisma generate`; no `rsync -aL`; no remote `nest build`; avoid full monorepo `node_modules` — Kudu **504**). Do **not** use `--track-status true` — it waits indefinitely on "Starting the site…" while Nest crash-loops. Startup is verified by [`scripts/verify-api-appservice.sh`](../scripts/verify-api-appservice.sh) (`/health` + App Service log download, fail-fast on recent container exit/Nest errors).
- No secrets in GitHub Secrets. Missing OIDC Variables → skip (non-blocking).

## Root scripts

```bash
pnpm format:check   # Prettier
pnpm format
pnpm lint           # package stubs + root ESLint
pnpm test
pnpm build
pnpm stage:api-deploy           # local App Service zip staging (Linux / WSL + Node)
pnpm stage:api-deploy -- --kudu # + Kudu node_modules.tar.gz extract smoke
pnpm stage:api-deploy:docker -- --kudu  # Windows-friendly (copy into Linux container)
```

## PR hygiene (conflicts, CI, feedback)

Agents do **not** get push notifications. Poll GitHub before ClickUp handoffs (`AGENTS.md` § PR hygiene). Workflow: `.github/workflows/pr-hygiene.yml`.

| Label | Meaning | Cleared when | Agent action |
| --- | --- | --- | --- |
| `needs-rebase` | Merge conflicts with base (`mergeable_state=dirty`) | Mergeability is known and not `dirty` (never cleared while `unknown`) | Merge/rebase `main`, fix, push, re-check CI → ClickUp **READY FOR AI** |
| `ci-failed` | A watched PR workflow failed | No `FAILURE` checks remain on the PR after a success | Diagnose via linked run; fix or document human blocker → **READY FOR AI** |
| `has-feedback` | Bugbot or human (non-author) comment | PR `synchronize` (new push); re-applied if new feedback arrives | Fetch issue + review comments; address or bounce → **READY FOR AI** |

```bash
gh pr list --label needs-rebase
gh pr list --label ci-failed
gh pr list --label has-feedback
gh pr view <n> --json mergeable,mergeStateStatus,statusCheckRollup
gh api repos/singleton-sd/poc-plattform-kit/issues/<n>/comments --jq '.[].body'
gh api repos/singleton-sd/poc-plattform-kit/pulls/<n>/comments --jq '.[].body'
```

Triggers: PR opened/synchronize (dirty check + clear `has-feedback` on sync), push to `main` (scan open PRs), completed `workflow_run` for CI/preview workflows (set/clear `ci-failed`), issue/review comments from Bugbot or collaborators. The hygiene workflow needs `checks: read` so the success path can query `statusCheckRollup` (with a check-runs API fallback) when clearing `ci-failed`.

**READY FOR HUMAN** only when mergeable, required checks green, and no open actionable feedback. ClickUp API bridge from Actions is phase 2; v1 uses labels + PR comments.
