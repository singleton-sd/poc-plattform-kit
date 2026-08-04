# PR pipelines & preview environments

`[repo=singleton-sd/poc-plattform-kit]`

## Path filters (FE / BE split)

| Workflow | Triggers when paths change | Checks |
| --- | --- | --- |
| `ci-web.yml` | `apps/web/**`, `packages/**` | prettier check, lint, build, test (web + packages) |
| `ci-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | prettier check, lint, test, build (api + pillars + packages) |
| `preview-web.yml` | `apps/web/**`, `packages/**` | SWA **PR preview** (Free) via OIDC → Key Vault |
| `preview-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | Path A stub comment only |
| `deploy-web.yml` | `apps/web/**`, `packages/**` on **`main`** | SWA **production** via OIDC → Key Vault |
| `deploy-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` on **`main`** | Nest zip → App Service F1 via OIDC |

**Shared packages:** changes under `packages/**` run **both** `ci-web` and `ci-api`. FE-only PRs skip API CI; API/pillar-only PRs skip web CI. Push to `main` with the same paths also runs the matching **deploy-*** workflow.

Branch naming stays `feature/<clickup-task-id>-<kebab-title>`. Humans only merge to `main`. Solo-repo: require CI checks, **not** approving reviews (see `SETUP.md`).

## Secrets / config for pipelines (locked)

| Allowed in GitHub | Forbidden in GitHub |
| --- | --- |
| Variables: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (IDs) | Any secret: SWA deploy token, connection strings, passwords, client secrets |
| Built-in `GITHUB_TOKEN` for PR comments | `AZURE_STATIC_WEB_APPS_API_TOKEN` or similar |

Flow: **Azure Login (OIDC)** → `az keyvault secret show` / App Config → use value only as a **job env var** (mask in logs; never a GitHub Secret).

If OIDC Variables are missing, `preview-web.yml` / `deploy-web.yml` / `deploy-api.yml` **skip** deploy (job succeeds) so CI is not blocked forever. Set the three Variables when ready.

`deploy-api.yml` also needs the OIDC app registration (`ssd-pocpk-gha-oidc-dev`) to have **Website Contributor** on `pocpk-api-si5fhs6dvxiha` (SWA production uses the KV deploy token only).

### OIDC subject forms (Entra FIC)

GitHub may emit **ID-form** OIDC subjects such as `repo:ORG@ORG_ID/REPO@REPO_ID:pull_request` (and the matching `:ref:refs/heads/main` form). The Entra federated identity credential **subject must match that `sub` claim exactly**. Classic subjects (`repo:org/repo:pull_request`) can remain on the app registration for compatibility when tokens still use them.

`preview-web.yml` uses `azure/login@v2` with job `permissions.id-token: write` for OIDC.

### Node version

CI/preview workflows use **Node 24**. Prefer upgrading actions over setting `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` (only if forced by an unupgradable action).

Secrets live in **Key Vault** `ssd-pocpk-kv-dev-ae`. Non-secret config + KV refs live in **App Configuration** `ssd-pocpk-appcs-dev-ae`.

## Preview strategy (locked Path A)

### FE — SWA Free PR previews (yes)

Azure Static Web Apps **Free** includes PR preview environments.

- Workflow: `.github/workflows/preview-web.yml`
- Action: `Azure/static-web-apps-deploy@v1`
- App location: `apps/web/out` (Next.js static export; workflow builds first)
- Token: Key Vault secret `swa-deployment-token` (populated from `az staticwebapp secrets list`; never committed; never a GitHub secret)

### BE — no slots on F1 (Path A)

True **deployment slots** need App Service **Standard (S1)+**. PoC uses **F1 Free**.

| Option | Cost | Status |
| --- | --- | --- |
| **Path A (locked)** | Stay on F1 | CI build/test only; `preview-api.yml` documents strategy |
| Path A optional | Second F1 app `pocpk-api-preview` | Overwrite per PR; concurrency risk |
| **Path B** | Container Apps (or S1 slots) | Must use **OIDC → KV / App Config** — same locked secret model |

Until Path B: treat API **PR** preview as **CI green + local**. **Production** API on `main` is deployed by `deploy-api.yml` to App Service F1 (`pocpk-api-si5fhs6dvxiha`).

## Production deploy on `main` (locked)

| Workflow | Host | Auth |
| --- | --- | --- |
| `deploy-web.yml` | SWA Free production (`kind-rock-0f409fe00.7.azurestaticapps.net`) | OIDC → KV `swa-deployment-token` |
| `deploy-api.yml` | App Service F1 (`pocpk-api-si5fhs6dvxiha.azurewebsites.net`) | OIDC → `azure/webapps-deploy` (needs **Website Contributor**) |

- Triggers: `push` to `main` with the same path filters as CI/preview.
- Builds in the job (web → `apps/web/out`; API → staged `.deploy/api` with `dist/` + prod `node_modules`).
- API startup: `node dist/main.js` (set each deploy; `package.json` `"start"` matches).
- No secrets in GitHub Secrets. Missing OIDC Variables → skip (non-blocking).

## Root scripts

```bash
pnpm format:check   # Prettier
pnpm format
pnpm lint           # package stubs + root ESLint
pnpm test
pnpm build
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
