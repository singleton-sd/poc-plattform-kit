# SETUP — human checklist

## 1. GitHub

- [x] Repo exists: `https://github.com/singleton-sd/poc-plattform-kit` (SSH: `git@github-personal:singleton-sd/poc-plattform-kit.git`; personal remotes use the `github-personal` SSH host alias)
- [x] Push `main` from `C:\00Personal\singleton-sd\poc-plattform-kit`
- [ ] Branch protection on `main` (solo-repo policy — see below)
- [ ] Optional ruleset for `feature/*` branch naming (see below)
- [ ] Connect repo in [Cursor Integrations](https://cursor.com/dashboard/integrations)

### Solo-repo branch protection (locked)

This is a **solo** GitHub identity repo. GitHub forbids self-approve, so **do not** require approving reviews.

**Protect `main`:**

1. Open the repo → **Settings** → **Rules** → **Rulesets** (or classic **Branches**).
2. Require a pull request before merging; **require status checks** (CI workflows) to pass.
3. **Do not** require approving reviews (blocks the same human/AI identity that authored the PR).
4. Block force pushes and deletions; disallow direct pushes to `main`.
5. **Human merge only** — agents never merge. AI reviews are **comments only** when the reviewer shares the author’s GitHub identity.

### Branch naming (agents + optional GitHub rules)

**Convention (primary — agents follow `AGENTS.md`):**

```
feature/<clickup-task-id>-<kebab-title>
```

Example: `feature/86dxxxx-prisma-azure-sql`

**Where to click in GitHub (optional enforcement):**

1. Open the repo → **Settings** → **Rules** → **Rulesets**.
2. **Protect `main`:** as above (CI + human merge; no required approvals).
3. **Optional `feature/*` pattern:** New ruleset targeting `refs/heads/feature/*`. Prefer documenting the convention in `AGENTS.md` and using rulesets as a safety net.
4. Ensure PRs into `main` come from feature/hotfix branches only (agents never merge; humans merge).

## 2. ClickUp (workspace `90161394355`) — locked locations

- **Tickets list (only):** https://app.clickup.com/90161394355/v/li/901616287298 (`901616287298`) in space PoC
- **Architecture Doc:** https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- **Decisions / Docs folder:** https://app.clickup.com/90161394355/v/f/901610744236/90165834867 (`folder_id=901610744236`)
- Do **not** create a new Platform Kit space/list
- Statuses already on the list: **TO DO**, **IN PROGRESS**, **READY FOR AI**, **READY FOR REVIEW**, **READY FOR HUMAN**, **COMPLETE**
- Ticket template includes `[repo=singleton-sd/poc-plattform-kit]`, acceptance criteria, tests
- [ ] Connect ClickUp ↔ Cursor (App Center + Cursor API key); default repo = this GitHub repo

## 3. Agent automations

- [ ] Implementer: pick tickets in **READY FOR AI** → **assign self** (`assignees: ["me"]`) → **IN PROGRESS** → PR → **PR hygiene** (CI + mergeable) → **READY FOR REVIEW**
- [ ] Reviewer: pick tickets in **READY FOR REVIEW** → **assign self** for the review phase (comment prior implementer if they must stay visible) → post review **comments** → hygiene (mergeable + CI + Bugbot/human feedback) → **READY FOR HUMAN**
- [ ] Assignment only when claiming work — not when browsing
- [ ] Humans only: merge PR when **READY FOR HUMAN**, then set **COMPLETE**
- [ ] PR hygiene labels (`needs-rebase`, `ci-failed`, `has-feedback`) from `.github/workflows/pr-hygiene.yml` — see `docs/pr-pipelines.md` / `AGENTS.md`

## 4. Azure

**Subscription:** **ssd-poc-plattform-kit** / `7b8343d7-969f-4b71-8864-b7925e7fae30`  
**Tenant:** `9a0e57d7-e58e-4e8b-814d-037cd7d9015c`  
**Resource group:** `rg-poc-plattform-kit` (region `australiaeast`; SWA Free in `eastasia`)  
**IaC:** [`infra/`](./infra/) — `powershell -File ./infra/deploy.ps1`

### Locked: cost + naming

- **Cost:** cheapest SKUs that still work — SQL **Basic**, App Service **F1 Free** (B1 only if needed), SWA **Free**, Service Bus **Standard** (topics; not Premium), Key Vault **Standard**, App Configuration **Free**.
- **Naming (new resources):** CAF `{org}-{app}-{resource}-{env}-{region}` → e.g. `ssd-pocpk-kv-dev-ae`, `ssd-pocpk-appcs-dev-ae`.
- **Legacy live names** (`pocpk-*-si5fhs6dvxiha`) stay as-is (renames recreate). See alias table in [`infra/README.md`](./infra/README.md).

### Provisioned (2026-08-04)

| Kind | Name | URL / notes | SKU |
| --- | --- | --- | --- |
| SQL Server / DB | `pocpk-sql-si5fhs6dvxiha` / `pocpk` | `pocpk-sql-si5fhs6dvxiha.database.windows.net` | Basic |
| App Service Plan + API | `pocpk-plan` / `pocpk-api-si5fhs6dvxiha` | https://pocpk-api-si5fhs6dvxiha.azurewebsites.net | F1 Free |
| Static Web App | `pocpk-web-si5fhs6dvxiha` | https://kind-rock-0f409fe00.7.azurestaticapps.net | Free |
| Service Bus | `pocpk-sb-si5fhs6dvxiha` | `pocpk-sb-si5fhs6dvxiha.servicebus.windows.net` | Standard |
| Key Vault | `ssd-pocpk-kv-dev-ae` | https://ssd-pocpk-kv-dev-ae.vault.azure.net/ | Standard |
| App Configuration | `ssd-pocpk-appcs-dev-ae` | https://ssd-pocpk-appcs-dev-ae.azconfig.io | Free |

Topics: `tenant.events`, `single-sign-on.events`, `subscriptions.events`, `contact.events`, `support.events`, `audit.events`, `reporting.events`. Consumers `audit` / `reporting` / `support` on publishing topics.

### Secrets + configuration (locked)

| Layer | Store | Rule |
| --- | --- | --- |
| **Secrets** | Azure Key Vault `ssd-pocpk-kv-dev-ae` | Passwords, connection strings, SWA deploy token, Entra client secrets. **Never** in git or GitHub Actions secrets. |
| **App configuration** | Azure App Configuration `ssd-pocpk-appcs-dev-ae` | Non-secret settings + **Key Vault references** for secret values (not inline secrets). |
| **CI/CD** | GitHub Actions **OIDC** → Azure | Workflows log in with federated creds, then `az keyvault secret show` / App Config at **job runtime**. |

**Key Vault secret names (not values):** `sql-admin-password`, `database-url`, `servicebus-connection-string`, `swa-deployment-token`  
*(Later after Entra: `auth-secret`, `azure-ad-client-secret`, …)*

**GitHub Actions — allowed identifiers only (repository Variables, not Secrets):**

| Variable | Purpose |
| --- | --- |
| `AZURE_CLIENT_ID` | OIDC app registration application (client) ID |
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |

App registration: `ssd-pocpk-gha-oidc-dev` with federated credentials. Prefer **ID-form** subjects (`repo:ORG@ORG_ID/REPO@REPO_ID:pull_request` / `:ref:refs/heads/main`); classic `repo:org/repo:...` subjects may remain for compatibility. **FIC subject must match JWT `sub` exactly.** Roles: **Reader** on RG, **Key Vault Secrets User**, **App Configuration Data Reader**, and **Website Contributor** on `pocpk-api-si5fhs6dvxiha` (required for `deploy-api.yml`).

**Do not** store `AZURE_STATIC_WEB_APPS_API_TOKEN`, connection strings, passwords, or deploy tokens in GitHub Secrets.

| Surface | Rule |
| --- | --- |
| Local | Pull from KV / App Config. Do not commit secrets. `.env` is optional gitignored cache. |
| GitHub Actions | OIDC → Azure login → Key Vault / App Config at runtime. |
| App Service / SWA / Container Apps | Prefer App Configuration provider + KV references for secrets. |

- [x] CLI identity can see the subscription
- [x] Core deploy succeeded — SQL, App Service (F1), SWA Free, Service Bus Standard
- [x] Key Vault `ssd-pocpk-kv-dev-ae` provisioned; SQL/SB/SWA secrets in KV
- [x] App Configuration `ssd-pocpk-appcs-dev-ae` (Free) + KV references seeded
- [x] GitHub OIDC app + federated credentials + Variables set; **no** deploy tokens in GitHub Secrets
- [x] Local `.env` written by deploy (gitignored); `.env.example` has placeholders
- [ ] Entra app registration (SPA + API) — secrets in KV; config keys in App Config
- [ ] Tighten SQL firewall (`AllowAllDevPoC` → your IP)
- [ ] Wire App Service / SWA / ACA to App Configuration provider + managed identity
- [ ] Confirm Nest runs acceptably on F1; bump to B1 only if Free is insufficient
- [x] Grant **Website Contributor** on `pocpk-api-si5fhs6dvxiha` to `ssd-pocpk-gha-oidc-dev` (needed once for `deploy-api.yml`)
- [ ] (Optional Path B) Container Apps API preview — same OIDC → KV/App Config pattern (no GH secrets)

### OIDC bootstrap (if Variables missing / admin consent)

1. App registration `ssd-pocpk-gha-oidc-dev` already created in tenant `9a0e57d7-e58e-4e8b-814d-037cd7d9015c`.
2. Federated credentials (issuer `https://token.actions.githubusercontent.com`). **Entra FIC `subject` must match the JWT `sub` exactly.**
   - **ID-form (current GitHub default for many orgs):** `repo:ORG@ORG_ID/REPO@REPO_ID:pull_request` and `repo:ORG@ORG_ID/REPO@REPO_ID:ref:refs/heads/main` (numeric org/repo IDs). Example shape: `repo:singleton-sd@NNNN/poc-plattform-kit@MMMM:pull_request`.
   - **Classic (optional compatibility):** keep `repo:singleton-sd/poc-plattform-kit:pull_request` and `repo:singleton-sd/poc-plattform-kit:ref:refs/heads/main` if tokens still emit that form.
   - Tip: decode a failed job's OIDC token / check the Azure login error for the exact `sub`, then set FIC subjects to match (both forms can coexist on the app registration).
3. Ensure repo **Variables** `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` match the app/sub/tenant.
4. If login fails with consent errors: Entra admin grants the enterprise app access (tenant admin consent for the SP) — Portal → Enterprise applications → `ssd-pocpk-gha-oidc-dev` → Permissions / admin consent, or re-run role assignments as subscription Owner.
5. SWA deploy token lives only in KV as `swa-deployment-token` (`az staticwebapp secrets list` → `az keyvault secret set`).
6. For App Service zip deploy (`deploy-api.yml`), grant the OIDC SP Website Contributor on the web app:

```bash
az role assignment create \
  --assignee <ssd-pocpk-gha-oidc-dev-app-id> \
  --role "Website Contributor" \
  --scope /subscriptions/7b8343d7-969f-4b71-8864-b7925e7fae30/resourceGroups/rg-poc-plattform-kit/providers/Microsoft.Web/sites/pocpk-api-si5fhs6dvxiha
```


### GitHub Actions runtime (Node)

Workflows pin **Node 24** via `actions/setup-node` (`ci-web`, `ci-api`, `preview-web`, `deploy-web`, `deploy-api`). Prefer Node 24; do **not** set `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` unless a third-party action forces an unsupported Node and you have no upgrade path.

## 5. PR pipelines & previews

See full matrix: [`docs/pr-pipelines.md`](./docs/pr-pipelines.md).

| Workflow | Paths | What it does |
| --- | --- | --- |
| `ci-web.yml` | `apps/web/**`, `packages/**` | prettier check, lint, build, test |
| `ci-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | prettier check, lint, test, build |
| `preview-web.yml` | `apps/web/**`, `packages/**` | SWA **PR preview** via OIDC → KV token |
| `preview-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | Path A stub comment (no slot on F1) |
| `deploy-web.yml` | same as ci-web, **`push` `main`** | SWA **production** via OIDC → KV |
| `deploy-api.yml` | same as ci-api, **`push` `main`** | Nest → App Service F1 via OIDC |

- **FE-only PRs** skip API CI; **API-only** skip web CI; **`packages/**`** runs both.
- **FE preview:** SWA Free PR environments; token from Key Vault at runtime (OIDC). If OIDC Variables are unset, deploy **skips** (non-blocking).
- **Production on merge:** `deploy-web.yml` / `deploy-api.yml` publish to the live SWA hostname and App Service URL (same OIDC skip behaviour).
- **BE preview (Path A locked):** no deployment slots on F1; CI validates API on PRs. Path B (Container Apps) must also use OIDC → KV/App Config — never GitHub secret tokens.
- Branch naming: `feature/<clickup-task-id>-<kebab-title>`. **Humans only** merge PRs.

## 6. Skills

Curated skills are committed under `.cursor/skills/`. Refresh from local source:

```powershell
pnpm sync:skills
```

Source: `C:\00Personal\singleton-sd\ai-plattform\skills` (also on GitHub `singleton-sd/ai-plattform-skills`).
