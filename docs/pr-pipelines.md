# PR pipelines & preview environments

## Path filters (FE / BE split)

| Workflow | Triggers when paths change | Checks |
| --- | --- | --- |
| `ci-web.yml` | `apps/web/**`, `apps/marketing/**`, `apps/marketing-oauth/**`, `packages/**` | prettier check, lint, build, test (web + marketing + Decap OAuth + packages) |
| `ci-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | prettier check, lint, test, build (api + pillars + packages) |
| `preview-web.yml` | `apps/web/**`, `packages/**` (skips deploy when only generated api-client OpenAPI/Orval files change) | **Container Apps** ephemeral web preview (Consumption) |
| `chromatic.yml` | `apps/web/**`, `packages/**` | Storybook publish/capture (Actions); visual review is Chromatic **UI Tests** (pending until accept) via OIDC → Key Vault |
| `playwright.yml` | `apps/web/**`, `packages/**` | Chromium public journeys against a local production-like static export; failure artifacts retained 7 days |
| `preview-marketing.yml` | `apps/marketing/**` | Marketing SWA **PR preview** (Free) via OIDC → Key Vault (`apps/marketing/dist`) |
| `preview-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | **Container Apps** ephemeral preview (Consumption) |
| `deploy-web.yml` | `workflow_dispatch` from `release.yml` when `apps/web/package.json` bumps (also manual `workflow_dispatch`; push+`chore: Release` kept as fallback) | SWA **production** via OIDC → Key Vault |
| `deploy-marketing.yml` | `apps/marketing/**` on **`main`** | Marketing SWA **production** via OIDC → Key Vault (`apps/marketing/dist` after Astro build) |
| `deploy-decap-oauth.yml` | `apps/marketing-oauth/**`, `infra/decap-oauth.bicep` on **`main`** (also `workflow_dispatch`) | Decap GitHub OAuth Function App via OIDC → KV |
| `deploy-api.yml` | `workflow_dispatch` from `release.yml` when `apps/api/package.json` bumps (also manual `workflow_dispatch`; push+`chore: Release` kept as fallback) | Nest zip → App Service **B1** via OIDC |
| `release.yml` | push to **`main`** (skipped for `chore: Release` commits) | Path-aware bumps; commit + tags; then `gh workflow run` deploy-api / deploy-web |

**Shared packages:** changes under `packages/**` run **both** `ci-web` and `ci-api`. FE-only PRs skip API CI; API/pillar-only PRs skip web CI. On **`main`**, `release.yml` bumps versions for changed packages (conventional commits: `fix`→patch, `feat`→minor, `BREAKING CHANGE`→major; cascades api/web when `packages/**` / `pillars/**` change). It then **dispatches** matching **deploy-*** workflows via `workflow_dispatch` on **`main`** (the release tip; `gh workflow run --ref` requires a branch/tag, not a raw SHA) so shipped builds embed the new `package.json` version in the web footer / Swagger. A plain `GITHUB_TOKEN` push of the release commit does **not** start other workflows — do not rely on the push event alone.

Branch naming is `<type>/<issue-number>-<kebab-title>` (e.g. `docs/174-github-native-orchestration-instructions`) per section 6 of [`docs/github-source-of-truth.md`](../docs/github-source-of-truth.md); legacy `feature/<clickup-task-id>-<kebab-title>` branches remain supported for ClickUp-tracked tickets still in flight. Create the matching worktree with `pnpm worktree:add` under the parent workspace `worktrees/` folder (see `AGENTS.md`). Humans only merge to `main`. Solo-repo: require CI checks, **not** approving reviews (see `SETUP.md`).

## Secrets / config for pipelines (locked)

| Allowed in GitHub | Forbidden in GitHub |
| --- | --- |
| Variables: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (IDs) | Any secret: SWA deploy token, connection strings, passwords, client secrets, ACR admin, `AZURE_CREDENTIALS` |
| Built-in `GITHUB_TOKEN` for PR comments | `AZURE_STATIC_WEB_APPS_API_TOKEN` or similar |

Flow: **Azure Login (OIDC)** → `az keyvault secret show` / App Config → use value only as a **job env var** (mask in logs; never a GitHub Secret).

If OIDC Variables are missing, `preview-marketing.yml` / `deploy-web.yml` / `deploy-marketing.yml` / `deploy-api.yml` **skip** deploy (job succeeds) so CI is not blocked forever. `preview-api.yml` and `preview-web.yml` **fail fast** with a clear error until Variables + RBAC are configured.

`deploy-api.yml` also needs the OIDC app registration (`ssd-pocpk-gha-oidc-dev`) to have **Website Contributor** on `pocpk-api-si5fhs6dvxiha` (SWA production uses the KV deploy token only).

### OIDC subject forms (Entra FIC)

GitHub may emit **ID-form** OIDC subjects such as `repo:ORG@ORG_ID/REPO@REPO_ID:pull_request` (and the matching `:ref:refs/heads/main` form). The Entra federated identity credential **subject must match that `sub` claim exactly**. Classic subjects (`repo:org/repo:pull_request`) can remain on the app registration for compatibility when tokens still use them.

Web, marketing, and API preview workflows use `azure/login@v2` with job `permissions.id-token: write` for OIDC.

### Node version

CI/preview workflows use **Node 24**. Prefer upgrading actions over setting `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` (only if forced by an unupgradable action).

Secrets live in **Key Vault** `ssd-pocpk-kv-dev-ae`. Non-secret config + KV refs live in **App Configuration** `ssd-pocpk-appcs-dev-ae`.

## Preview strategy (locked)

### FE — web PR previews (Container Apps) + marketing SWA Free

**Web app (PR previews)**

Web **PR** previews run on **Azure Container Apps Consumption** (same Path B pattern as the API). Production web stays on SWA **Free**.

- Workflow: `.github/workflows/preview-web.yml`
- Image: `apps/web/Dockerfile` (Next static export + nginx) pushed to ACR `pocpk-web:pr-<n>`
- App: `ssd-pocpk-aca-web-pr-<n>-ae` on `ssd-pocpk-cae-dev-ae` (do **not** reuse `ssd-pocpk-aca-pr-<n>-ae`)
- Auth: OIDC → Key Vault `acr-admin-*` (never a GitHub secret; never the SWA deploy token)
- After deploy: `scripts/entra-spa-preview-redirect.sh add --origin https://<fqdn>` registers the preview origin as an Entra **SPA** redirect URI (MSAL). On PR `closed`, ACA/ACR cleanup uses the per-PR `preview-web-*` concurrency group (cancels in-flight deploy). Entra URI removal is a **separate job** on the global `entra-spa-preview-redirects` group (same as registration and the orphan sweep) so overlapping read-modify-PATCH of `spa.redirectUris` cannot clobber each other. The close job captures the origin before deleting the app. Requires Graph `Application.ReadWrite.OwnedBy` + ownership on the Entra app (see `docs/sso.md`); missing rights soft-fail.
- Generated-only OpenAPI/Orval diffs under `packages/api-client/openapi.json` and `packages/api-client/src/generated/**` skip the web ACA build/deploy (job succeeds with a notice) so preview apps are not created for generated-only PRs — see `scripts/should-run-web-preview.mjs`.
- `NEXT_PUBLIC_API_BASE_URL` is this PR’s API preview `ssd-pocpk-aca-pr-<n>-ae` when that app exists, otherwise the production API.

**Marketing**

- Workflow: `.github/workflows/preview-marketing.yml`
- Action: `Azure/static-web-apps-deploy@v1`
- App location: `apps/marketing/dist` (Astro SSG; workflow builds + validates `staticwebapp.config.json` first)
- Token: Key Vault secret `swa-marketing-deployment-token`
- Close job on PR `closed` (same pattern as web)
- SWA resource `ssd-pocpk-mkt-dev-ae` must have `stagingEnvironmentPolicy: Enabled` (web SWA already does). If deploy logs say “Staging environments are not allowed”, enable via ARM:

```bash
az rest --method patch \
  --url "https://management.azure.com/subscriptions/<sub>/resourceGroups/rg-poc-plattform-kit/providers/Microsoft.Web/staticSites/ssd-pocpk-mkt-dev-ae?api-version=2022-03-01" \
  --body '{"properties":{"stagingEnvironmentPolicy":"Enabled"}}'
```

### Preview orphan sweep (daily)

Close hooks can miss leftovers (shared concurrency races, path-filtered `closed`
events, Graph soft-fails). Workflow:
[`.github/workflows/sweep-preview-orphans.yml`](../.github/workflows/sweep-preview-orphans.yml)
runs daily (06:15 UTC) and on `workflow_dispatch` via
[`scripts/sweep-preview-orphans.sh`](../scripts/sweep-preview-orphans.sh).

| Target | Action when PR number is not open |
| --- | --- |
| ACA `ssd-pocpk-aca-pr-<n>-ae` | `az containerapp delete` |
| ACA `ssd-pocpk-aca-web-pr-<n>-ae` | `az containerapp delete` |
| SWA staging builds (web + marketing), except `default` | `az staticwebapp environment delete` |
| ACR tags `pocpk-api:pr-<n>` / `pocpk-web:pr-<n>` (and `pr-<n>-<sha>`) | `az acr repository delete` |
| Entra SPA redirect URIs matching SWA or ACA web PR preview hosts | Graph PATCH (same ownership as `preview-web.yml`) |

Manual dry-run:

```bash
gh workflow run sweep-preview-orphans.yml -f dry_run=true
# or locally (az + gh logged in):
./scripts/sweep-preview-orphans.sh --dry-run
```

OIDC uses the **main** federated credential (schedule / `workflow_dispatch` on
`main`). Ensure FIC subjects cover `ref:refs/heads/main` (and ID-form if used).

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

1. **PR open/sync** (paths `apps/api/**`, `pillars/**`, `packages/**`):
   - Resolve `PREVIEW_SEED_SCENARIOS` from the PR body (a `Preview scenarios: name1, name2` line, defaulting to `demo` — see [`docs/preview-scenarios.md`](../docs/preview-scenarios.md)).
   - Build `apps/api/Dockerfile` with `--build-arg PREVIEW_SEED_SCENARIOS=...` — every PR preview gets its **own isolated, disposable SQLite database**, seeded and verified at build time, baked into the image as an immutable template. It never resolves or mutates the shared Azure SQL database.
   - Push `…/pocpk-api:pr-<n>`, create/update the Container App with explicit `DATABASE_URL=file:/app/data/preview.db` and `AZURE_SERVICEBUS_CONNECTION_STRING=` (empty) — App Configuration cannot override either (explicit env vars win), so a preview can never resolve the shared `secret:database-url`, and `OutboxDrainerService` stays disabled so no seeded outbox row can ever reach the real Service Bus.
   - Wait for `GET /health/db` (proves Prisma can query the container's writable copy of the seeded database — `docker-entrypoint.sh` already re-verifies every declared scenario's fixtures before Nest starts listening at all).
   - Comment the preview URL, database mode, active scenarios, reset behaviour, and a link to `docs/preview-scenarios.md` for test instructions.
2. **PR close:** delete `ssd-pocpk-aca-pr-<n>-ae`.
3. **Reset:** redeploying (any new commit) copies the immutable template back over the writable database — mutations made while testing never persist. Max replicas stays `1`.
4. **Daily orphan sweep:** `sweep-preview-orphans.yml` deletes leftovers if
   close cleanup was skipped (path filters, cancelled run, Graph soft-fail).

#### GitHub Azure auth (human)

**OIDC only** (`AZURE_CREDENTIALS` / SP-JSON is not supported):

1. Entra app + federated credential for `repo:singleton-sd/poc-plattform-kit:pull_request` (and ID-form subject if tokens use it).
2. RBAC: Contributor on `rg-poc-plattform-kit`, Key Vault Secrets User on `ssd-pocpk-kv-dev-ae` (ACR admin secrets already in KV from `deploy-aca-preview.ps1`).
3. Repository **Variables** (not Secrets): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
4. Workflow fails fast if any OIDC Variable is missing.
5. Image push + ACA registry attach use OIDC → KV `acr-admin-*` (never GitHub Secrets / `AZURE_CREDENTIALS`).

Nest listens on `PORT` (default `3001` in the image / ACA env). Liveness: `/health`. Database-aware readiness (preview only): `/health/db`.

### OpenFGA authZ engine (shared CAE — not per-PR)

Fine-grained `Check()` runs against a **shared** OpenFGA Container App on the same CAE (not an ephemeral PR app).

| Resource | Name | Notes |
| --- | --- | --- |
| Container App | `ssd-pocpk-openfga-dev-ae` | `openfga/openfga` pinned tag; min replicas 1 |
| Azure Files | `ssdpocpkstofga` / `openfga-data` | SQLite datastore (**beta**); durability without container-local disk |
| Entra app | `api://ssd-pocpk-openfga` | OIDC authn; assignment-required; Nest App Service MI only (PR ACA MIs not assigned — preview Check fail-closed) |
| App Config | `app:openfga:*` | `apiUrl` / `storeId` / `authorizationModelId` / `audience` |

Provision / re-bootstrap (idempotent; OIDC login same Variables as above — no GitHub Secrets):

```powershell
powershell -File ./infra/deploy-openfga.ps1
```

Bicep: `infra/openfga.bicep`. Model: `infra/openfga/model.fga`. Details: the "Permissions / OpenFGA" section of `infra/README.md`.

## Production deploy on `main` (locked)

| Workflow | Host | Auth |
| --- | --- | --- |
| `deploy-web.yml` | SWA Free production (`kind-rock-0f409fe00.7.azurestaticapps.net`) | OIDC → KV `swa-deployment-token` |
| `deploy-api.yml` | App Service (`pocpk-api-si5fhs6dvxiha.azurewebsites.net`) | OIDC → `az webapp deploy --type zip` (needs **Website Contributor**) |

- Triggers: primarily `workflow_dispatch` from `release.yml` after a version bump (and manual dispatch). Push to `main` with path filters + `chore: Release` message remains as a fallback if a non-`GITHUB_TOKEN` pusher is used.
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

Hygiene workflows set **labels only** — this is GitHub-native and tracker-neutral; it does not read from or write to ClickUp. They do not post “fix this” comments. The human presentation surface is one upserted **Human Review Brief** (`<!-- pr-review-brief -->`) from `scripts/upsert-pr-review-brief.mjs`.

| Label | Meaning | Cleared when | Agent action |
| --- | --- | --- | --- |
| `needs-rebase` | Merge conflicts with base (`mergeable_state=dirty`) | Mergeability is known and not `dirty` (never cleared while `unknown`) | `git merge origin/main` → `pnpm resolve:conflicts` → hand-fix leftovers → push → re-check CI |
| `ci-failed` | Required CI job failed (`Lint / test / build (api)` or `Lint / format / build (web)`) | Those jobs are no longer `FAILURE` | Fix the required CI cause and push |
| `has-feedback` | Bugbot, Copilot, or human (non-author) comment | PR `synchronize` when no unresolved threads remain | Fetch issue + review comments; address with a threaded reply |
| `preview-blocked` | SWA / ACA / Chromatic **infra** failed (OIDC, token, Storybook build, capture/interaction errors) | Those infra jobs are no longer `FAILURE` | Document on the brief. Do **not** bounce ClickUp. Pending Chromatic **UI Tests** (unreviewed visual diffs) is not infra and must not set this label. Visual-accept is human-only. |
| `ready-for-human` | Mergeable + required CI green + no open feedback | Any of `needs-rebase` / `ci-failed` / `has-feedback` is (re-)added | Nothing — applied by `pnpm pr:gate -- --pr <n>` once the PR clears the other three labels; see the "Enforced PR handoff gate" section below. |

```bash
gh pr list --label needs-rebase
gh pr list --label ci-failed
gh pr list --label has-feedback
gh pr list --label preview-blocked
gh pr list --label ready-for-human
gh pr view <n> --json mergeable,mergeStateStatus,statusCheckRollup
node scripts/upsert-pr-review-brief.mjs --pr <n>
```

Triggers: PR opened/synchronize (dirty check + clear `has-feedback` on sync), push to `main` (scan open PRs), completed `workflow_run` for CI Web/API (set/clear `ci-failed`) and preview/Chromatic (set/clear `preview-blocked`), issue/review comments from Bugbot/Copilot/collaborators. Usage-limit and `github-actions` comments are ignored.

A PR is ready for human merge only when mergeable, required lint/test/build checks are green, and there is no open actionable feedback — signalled by the `ready-for-human` label (see below). Preview red is an infra note on the brief, not a blocker.

## Shared hub conflicts (agent playbook)

Do **not** hand-merge `pnpm-lock.yaml` or `infra/main.json`. Prefer merge over rebase. Full hub ownership table: the **Shared hub files** section of `AGENTS.md`.

```text
1. git fetch origin main
2. git merge origin/main
3. pnpm resolve:conflicts
4. Hand-fix only paths the script still lists
5. If you fixed infra/main.bicep:
   az bicep build -f infra/main.bicep --outfile infra/main.json
   git add infra/main.json
   (or re-run pnpm resolve:conflicts)
6. Commit the merge, push
7. gh pr checks --watch; confirm mergeable
```

Script: `scripts/resolve-merge-conflicts.ps1` (`pnpm resolve:conflicts`).

| Path | Mechanical action |
| --- | --- |
| `pnpm-lock.yaml` | Take main → `pnpm install` → stage |
| `**/package.json` | JSON-merge deps/scripts keys from both sides |
| `infra/main.json` | `az bicep build` after `main.bicep` is clean |
| `.cursor/skills/**` | Take main (`-SkillsSync` only for skills-sync tickets) |
| `AGENTS.md`, `SETUP.md`, `docs/pr-pipelines.md`, `infra/README.md` | Take main (`-ForceKeepFeatureDocs` to hand-merge) |
| `.env.example` | Union unique `KEY=` lines |

Hand-fix leftovers: `infra/main.bicep`, `apps/api/src/main.ts`, `app.module.ts`, `.github/workflows/**`.

| Situation | main | feature |
| --- | --- | --- |
| Merging `main` into feature | `--theirs` | `--ours` |
| Rebasing onto `main` | `--ours` | `--theirs` |

## Issue closure (GitHub-native)

For GitHub-native work there is no separate "mark complete" step. Every PR
links its issue with a closing keyword (`Closes #N`) per
section 6 of [`docs/github-source-of-truth.md`](../docs/github-source-of-truth.md); a
human merging the PR closes the linked issue automatically, and no workflow
writes that status anywhere else. Do not add new automation that mirrors
GitHub issue/PR state back into a second system (source-of-truth policy section 2).

## Enforced PR handoff gate

A PR is ready for human review/merge only once it is mergeable, required CI
is green, and there is no open actionable feedback. This is enforced by the
same fail-closed logic that used to gate a ClickUp status write — it now
applies the GitHub-native `ready-for-human` label instead:

```bash
pnpm pr:gate -- --pr <pr-number>
```

(`pnpm pr:gate` runs `scripts/pr-handoff-gate.mjs`.) The gate pins the PR head
SHA, requires path-applicable **required** CI (`Lint / test / build (api)`,
`Lint / format / build (web)`, `conflict-on-pr`) to appear and finish
successfully, requires a mergeable/non-dirty PR, rejects `ci-failed` /
`has-feedback` / `needs-rebase`, and rejects unresolved review threads.
`preview-blocked` does not fail the gate. Empty check lists and `UNKNOWN`
mergeability fail closed. A reviewer quiet period is optional
(`PR_GATE_QUIET_SECONDS`, default `0`). Override polling with
`PR_GATE_TIMEOUT_SECONDS` and `PR_GATE_POLL_SECONDS`. Pass `--no-label` (or
set `PR_GATE_NO_LABEL=1`) to run the gate as a pure readiness check without
touching the `ready-for-human` label.

Run it after opening the PR and again after every push, before considering
the implementation done. On success it adds `ready-for-human` (creating the
label if needed); on failure/timeout it removes the label and reports the
blockers. There is **no** GitHub `pr-handoff-gate` commit status — do not add
it to the `main` branch protection ruleset; the label is the signal.

`.github/workflows/pr-review-brief.yml` upserts the same Human Review Brief
comment on PR open/sync and after CI/preview completion so humans always see
one presentation surface, independent of the `ready-for-human` label.

**Legacy ClickUp-tracked tickets:** `./scripts/clickup.sh handoff <task-id>
<pr-number> "READY FOR REVIEW" <claim-token>` still runs this same gate before
writing the ClickUp status, for tickets opened under the pre-migration
ClickUp Delivery workflow (see the "Legacy ClickUp workflow" section of `AGENTS.md`). New
GitHub-native work never calls `clickup.sh`.

## Legacy ClickUp automation (ClickUp-tracked tickets only)

The following workflows read or write ClickUp. They apply only to branches
matching `feature/<clickup-task-id>-...` / `hotfix/<clickup-task-id>-...` and
are no-ops for GitHub-native `<type>/<issue-number>-...` branches. They exist
to finish out ClickUp Delivery tickets already in flight and are retired by
[#177](https://github.com/singleton-sd/poc-plattform-kit/issues/177) /
[#178](https://github.com/singleton-sd/poc-plattform-kit/issues/178) per
section 8 of [`docs/github-source-of-truth.md`](../docs/github-source-of-truth.md). Do
not extend them to cover new engineering work.

- **`.github/workflows/complete-clickup-on-merge.yml`** runs when GitHub
  closes a merged pull request. It extracts the ClickUp task id from the
  branch name, verifies the task belongs to the Platform Kit ops list, and
  moves it to **COMPLETE**. Branches without a ClickUp task id (all
  GitHub-native branches) are skipped — the linked GitHub issue closes on its
  own via `Closes #N`.
- **`.github/workflows/clickup-pr-recovery.yml`** is the server-side safety
  net for ClickUp handoffs: on `ci-failed` / `has-feedback` / `needs-rebase`
  label changes, required CI completion, and `main` pushes, if a ClickUp
  ticket is already in `READY FOR REVIEW` or `READY FOR HUMAN` and the PR has
  a conflict, required CI failure, or blocking hygiene label, it clears Claim
  Token, returns the ticket to `READY FOR AI`, and posts one blocker-oriented
  ClickUp comment. `preview-blocked` does not bounce. GitHub-native PRs need
  no equivalent: `pr-hygiene.yml` already keeps `needs-rebase` / `ci-failed` /
  `has-feedback` / `ready-for-human` in sync with PR state reactively on every
  relevant event, so the label state itself is always current — there is
  nothing separate to "recover."

Both workflows authenticate to Azure with the repository's OIDC variables and
read `clickup-api-token` from Key Vault `ssd-pocpk-kv-dev-ae`; the token must
not be stored in GitHub Secrets.
