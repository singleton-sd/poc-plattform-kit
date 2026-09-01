# SETUP - human checklist

## 1. GitHub

- [x] Repo exists: `https://github.com/singleton-sd/poc-plattform-kit` (SSH: `git@github-personal:singleton-sd/poc-plattform-kit.git`; personal remotes use the `github-personal` SSH host alias)
- [x] Push `main` from `C:\00Personal\singleton-sd\poc-plattform-kit`
- [ ] Branch protection on `main` (solo-repo policy - see below)
- [ ] Optional ruleset for `feature/*` branch naming (see below)
- [ ] Connect repo in [Cursor Integrations](https://cursor.com/dashboard/integrations)

### Solo-repo branch protection (locked)

This is a solo GitHub identity repo. GitHub forbids self-approve, so do not require approving reviews.

**Protect `main`:**

1. Open the repo -> **Settings** -> **Rules** -> **Rulesets** (or classic **Branches**).
2. Require a pull request before merging; **require status checks** (CI workflows) to pass.
3. Do not require approving reviews (blocks the same human/AI identity that authored the PR).
4. Block force pushes and deletions; disallow direct pushes to `main`.
5. **Human merge only** - agents never merge or review other agents' work. Connected review bots leave PR comments; the human validates the test plan and merges.

**Platform GitHub automation PAT (org-wide, devtools Key Vault):**

Protected default branches block `GITHUB_TOKEN` pushes on Free orgs (GitHub Actions integration bypass is unavailable). Trusted workflows instead use a **single org-wide fine-grained PAT** owned by a shared machine user, loaded from the **devtools provision Key Vault** at runtime via OIDC — never a GitHub Secret and **never** in per-app Key Vaults (apps must not read CI credentials).

| Artifact | Name | Scope |
| --- | --- | --- |
| **Ops Key Vault** | `ssd-devtools-kv-prod-ae` | Org-wide CI/provision secrets (not app runtime). Subscription **Singleton SD** (`01c0bb8b-3770-4765-979a-cb13ae7e3dd2`), RG `ssd-devtools-rg-prod-ae`. |
| Key Vault secret | `github-automation-pat` | **One PAT for all org repos** |
| Workflow constants | `SSD_OPS_KEY_VAULT_*`, `SSD_GITHUB_AUTOMATION_PAT_SECRET` | Hardcoded at top of `release.yml` — copy workflow unchanged |
| Per-repo Variables | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` only | Same three OIDC vars deploy/preview already use |

Git commit author for release commits is resolved at runtime from the PAT (`GET /user`) — no extra repo Variables.

Per-app vault `ssd-pocpk-kv-dev-ae` holds **runtime** secrets only (DB, auth, SWA deploy tokens for that app, etc.). Do **not** store `github-automation-pat` there.

**Consumers today:** `release.yml` (version bumps + tags on `main`). **Future:** changelog sync, dependency bots, any job that must push through a ruleset bypass — copy the same OIDC → devtools KV pattern.

#### One-time org setup (once)

1. **Machine user** — e.g. `singleton-sd-automation`. Invite to the org; grant **Write** or **Maintain** on each repo that uses this pattern.
2. **Fine-grained PAT** (machine user → **Developer settings → Fine-grained tokens**):

   | Field | Value |
   | --- | --- |
   | **Token name** | `platform-automation` |
   | **Description** | See block below |
   | Resource owner | `singleton-sd` |
   | Repository access | **All repositories** the automation should touch (org-wide), or an explicit multi-repo list |

   **Repository permissions (minimum — nothing else required for release):**

   | Permission | Access | Why |
   | --- | --- | --- |
   | **Contents** | Read and write | Push release commits and tags to `main` |
   | **Metadata** | Read | Required by GitHub; used to resolve PAT owner via API |

   Do **not** grant Admin, Actions, or Pull requests unless a future workflow needs them.

   **Description** (paste into GitHub when creating the token):

   ```text
   Singleton SD platform automation — org-wide PAT for trusted GitHub Actions workflows that push to protected default branches (release versioning, tags, changelog/sync bots) across singleton-sd repositories. Loaded at runtime via Azure OIDC → Key Vault ssd-devtools-kv-prod-ae secret github-automation-pat; not stored as a GitHub Secret or in per-app Key Vaults. PAT owner must be on each target repository ruleset bypass list. Rotate on compromise or annually; update devtools Key Vault only.
   ```

3. **Key Vault** — store the PAT in **devtools** vault (never commit; never per-app vault):

   ```powershell
   az keyvault secret set `
     --subscription 01c0bb8b-3770-4765-979a-cb13ae7e3dd2 `
     --vault-name ssd-devtools-kv-prod-ae `
     --name github-automation-pat `
     --value '<fine-grained-pat>'
   ```

4. **Entra RBAC** — grant the GitHub Actions OIDC service principal (`ssd-pocpk-gha-oidc-dev` or your repo’s OIDC app) **Key Vault Secrets User** on `ssd-devtools-kv-prod-ae` (cross-subscription; same tenant). **Subscription-level roles on the devtools subscription are not required** — `release.yml` reads the secret via the Key Vault data plane (`*.vault.azure.net`), not `az keyvault` with `--subscription`. Repeat for each repo’s OIDC SP if they differ.

5. **Ruleset bypass (per repo)** — **Settings → Rules → Rulesets** → default-branch ruleset → **Bypass list → Add bypass** → select the machine **user** → **Always bypass**.

#### Per-repository setup (copy-paste checklist)

1. Copy `release.yml` (or the PAT-read steps) **unchanged** — org constants are in the workflow `env` block.
2. Ensure repo **Variables** exist: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (same as deploy/preview).
3. Grant this repo’s OIDC service principal **Key Vault Secrets User** on `ssd-devtools-kv-prod-ae`.
4. Add machine user to default-branch **ruleset bypass** (**Always bypass**).
5. **Verify** — human push to `main` rejected; **Release** can push and tag.

Without PAT + user bypass, automation fails with `GH013: Changes must be made through a pull request`.

### Branch naming (agents + optional GitHub rules)

**Convention (primary - agents follow the "GitHub-native engineering workflow" section of `AGENTS.md`):**

```
<type>/<issue-number>-<kebab-title>
```

Example: `feat/184-support-ticket-api`. `<type>` is a conventional-commit
prefix (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, etc.).

**Workspace layout (locked):** open a parent folder in Cursor that contains the clone and issue worktrees:

```text
plattform-kit/                 <-- Open this
  repo/                        <-- git clone (main only)
  worktrees/<issue-number>-<kebab-slug>/
```

Create worktrees with `pnpm worktree:add -- -Issue <n> -Type <type> -Slug <kebab>` (Windows/PowerShell) or `./scripts/add-worktree.sh --issue <n> --type <type> --slug <kebab>` (macOS / Linux / Docker / Cloud - see `AGENTS.md`). The parent folder can live anywhere on any OS, e.g. `~/dev/singleton-sd/plattform-kit/` on macOS or `/workspace/plattform-kit/` in a container. Do not create `poc-plattform-kit-wt-*` siblings next to other projects.

Legacy ClickUp-tracked tickets (existing `feature/<clickup-task-id>-...` /
`hotfix/<clickup-task-id>-...` branches only): `-TaskId <id>` /
`--task-id <id>` remain as aliases - see the "Legacy ClickUp workflow" section of `AGENTS.md`.
workflow. Do not use them for new work.

**Where to click in GitHub (optional enforcement):**

1. Open the repo -> **Settings** -> **Rules** -> **Rulesets**.
2. **Protect `main`:** as above (CI + human merge; no required approvals).
3. **Optional branch-name pattern:** New ruleset targeting
   `refs/heads/{feat,fix,docs,chore,refactor,test}/*`. Prefer documenting the
   convention in `AGENTS.md` and using rulesets as a safety net.
4. Ensure PRs into `main` come from those branches only (agents never merge; humans merge).

## 2. GitHub Issues (primary) and legacy ClickUp - locked locations

Engineering work is tracked in **GitHub Issues** in this repo - see
`docs/github-source-of-truth.md` and the "GitHub-native engineering workflow" section of `AGENTS.md`
workflow. The GitHub Project view (issue tracking board) is set up per
[#172](https://github.com/singleton-sd/poc-plattform-kit/issues/172).

The ClickUp locations below remain real for **business/commercial
planning** (per `docs/github-source-of-truth.md` section 1) and for finishing out
tickets already tracked in ClickUp Delivery until
[#177](https://github.com/singleton-sd/poc-plattform-kit/issues/177) /
[#178](https://github.com/singleton-sd/poc-plattform-kit/issues/178) land.
Do not file new engineering work in ClickUp Delivery.

- Existing workflow lists only (space PoC, folder Plattform Kit — do **not** create a new space/list):
  - **Delivery** (implementation / AI loop): https://app.clickup.com/90161394355/v/li/901616287298 (`901616287298`)
  - **Ideas & Discovery** (unresolved ideas, briefs, spikes): https://app.clickup.com/90161394355/v/li/901616397764 (`901616397764`)
  - **Human & Operations** (real manual actions): https://app.clickup.com/90161394355/v/li/901616397767 (`901616397767`)
- `scripts/clickup.ps1` / `scripts/clickup.sh` default to Delivery. Use `-ListId` / `--list-id` (or `CLICKUP_LIST_ID`) for the other two.
- **Architecture Doc:** https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- **Decisions / Docs folder:** https://app.clickup.com/90161394355/v/f/901610744236/90165834867 (`folder_id=901610744236`)
- Delivery statuses: **BACKLOG**, **TO DO**, **IN PROGRESS**, **READY FOR AI**, **READY FOR REVIEW**, **READY FOR HUMAN**, **COMPLETE**
- Ideas & Discovery / Human & Operations statuses: **TO DO**, **IN PROGRESS**, **COMPLETE** only (no Claim Token / AI loop)
- Ticket template includes acceptance criteria, tests (no repository marker needed - single-repo workspace)
- [ ] Connect ClickUp -> Cursor (App Center + Cursor API key); default repo = this GitHub repo

## 3. Agent automations

**GitHub-native (primary):**

- [ ] Implementer: pick an agent-ready GitHub Issue -> branch/worktree + open PR (`Closes #N`) is the claim -> **PR hygiene** (CI + mergeable + feedback labels) -> `pnpm pr:gate -- --pr <n>` applies `ready-for-human`
- [ ] Review bots: inspect open PRs and leave findings on GitHub; agents do not review other agents' work
- [ ] Human: follow the PR test plan, leave feedback, and merge only after CI and actionable bot findings are resolved - merging closes the linked issue automatically
- [ ] PR hygiene labels (`needs-rebase`, `ci-failed`, `has-feedback`, `preview-blocked`, `ready-for-human`) from `.github/workflows/pr-hygiene.yml` - see `docs/pr-pipelines.md` / `AGENTS.md`

**Legacy ClickUp (existing ClickUp-tracked tickets only, see the "Legacy ClickUp workflow" section of `AGENTS.md`):**

- [x] Agents use REST [`scripts/clickup.ps1`](scripts/clickup.ps1) + `CLICKUP_API_TOKEN` (not ClickUp MCP for routine ops)
- [ ] Implementer: pick tickets in **READY FOR AI** -> claim via `scripts/clickup.ps1 claim` -> **IN PROGRESS** -> PR -> **PR hygiene** (CI + mergeable) -> **READY FOR REVIEW**
- [ ] Assignment / Claim Token only when claiming work - not when browsing
- [x] Merge automation: merged ClickUp-tracked branches set ClickUp to **COMPLETE** via OIDC -> Key Vault (`clickup-api-token`) -> ClickUp REST (no-op for GitHub-native branches)

## 4. Azure

**Subscription:** **ssd-poc-plattform-kit** / `7b8343d7-969f-4b71-8864-b7925e7fae30`  
**Tenant:** `9a0e57d7-e58e-4e8b-814d-037cd7d9015c`  
**Resource group:** `rg-poc-plattform-kit` (region `australiaeast`; SWA Free in `eastasia`)  
**IaC:** [`infra/`](./infra/) - `powershell -File ./infra/deploy.ps1`

### Locked: cost + naming

- **Cost:** cheapest SKUs that still work - SQL **Basic**, App Service **B1** (custom-domain HTTPS + Nest always-on), SWA **Free** x2 (app + marketing production), Service Bus **Standard** (topics; not Premium), Key Vault **Standard**, App Configuration **Free**, ACR **Basic**, Container Apps **Consumption** (API + web PR previews + OpenFGA).
- **Naming (new resources):** CAF `{org}-{app}-{resource}-{env}-{region}` -> e.g. `ssd-pocpk-kv-dev-ae`, `ssd-pocpk-appcs-dev-ae`, `ssd-pocpk-mkt-dev-ae`. ACR is alphanumeric-only: `ssdpocpkacrdevae`.
- **Legacy live names** (`pocpk-*-si5fhs6dvxiha`) stay as-is (renames recreate). See alias table in [`infra/README.md`](./infra/README.md).

### Custom domains (locked) - DNS in AWS Route53

Public hostnames under `singletonsd.com` (DNS stays in **AWS**; Azure only gets CNAMEs / validation TXT):

| Hostname | Surface | Azure target |
| --- | --- | --- |
| `plattform-kit.poc.singletonsd.com` | Marketing | SWA `ssd-pocpk-mkt-dev-ae` (Free) |
| `app.plattform-kit.poc.singletonsd.com` | Web app (PWA/SPA) | SWA `pocpk-web-si5fhs6dvxiha` (Free) |
| `api.plattform-kit.poc.singletonsd.com` | Nest API | App Service `pocpk-api-si5fhs6dvxiha` (**B1**) |

PR / preview URLs stay on Azure defaults (`*.azurestaticapps.net` for marketing SWA and production web, `*.azurecontainerapps.io` for API and web PR previews) - no custom preview domains. API CORS / Auth.js redirects allow this repo's SWA instance prefixes (`https://kind-rock-0f409fe00*.azurestaticapps.net`, marketing SWA likewise) plus ACA web preview hosts (`ssd-pocpk-aca-web-pr-<n>-ae`) via `CORS_ORIGINS` / App Config `app:cors:origins` (see [docs/sso.md](./docs/sso.md)). Entra Auth.js callback stays on the API host; MSAL SPA redirect URIs need exact preview origins (no Entra wildcard).

#### Route53 checklist (zone `singletonsd.com` or delegated `poc.singletonsd.com`)

After Azure default hostnames are known (see provisioned table / `az` outputs):

| Record | Type | Value |
| --- | --- | --- |
| `plattform-kit.poc` | CNAME | marketing SWA default hostname |
| `app.plattform-kit.poc` | CNAME | web SWA default hostname (e.g. `kind-rock-....azurestaticapps.net`) |
| `api.plattform-kit.poc` | CNAME | `pocpk-api-si5fhs6dvxiha.azurewebsites.net` |
| (as prompted by Azure) | TXT | SWA / App Service domain validation |

Then bind custom domains + managed certs in Azure (`az staticwebapp hostname set`, App Service managed certificate). Do not move the zone to Azure DNS.

Exact live CNAME/TXT values and reusable apply scripts:
[`docs/dns-route53.md`](./docs/dns-route53.md) / [`infra/custom-domains.pocpk.json`](./infra/custom-domains.pocpk.json).

```powershell
powershell -File ./scripts/apply-route53-dns.ps1
powershell -File ./scripts/bind-custom-domains.ps1
```

Copy the JSON config to onboard another domain later (see `docs/dns-route53.md`).

### Provisioned (2026-08-04)

| Kind | Name | URL / notes | SKU |
| --- | --- | --- | --- |
| Neon PostgreSQL | project `round-union-05852948` / `neondb` | Key Vault `database-url` (+ `database-url-unpooled`) | Neon |
| App Service Plan + API | `pocpk-plan` / `pocpk-api-si5fhs6dvxiha` | https://api.plattform-kit.poc.singletonsd.com (default: `....azurewebsites.net`) | **B1** |
| Static Web App (app) | `pocpk-web-si5fhs6dvxiha` | https://app.plattform-kit.poc.singletonsd.com (default: `....azurestaticapps.net`) | Free |
| Static Web App (marketing) | `ssd-pocpk-mkt-dev-ae` | https://plattform-kit.poc.singletonsd.com (PR previews need `stagingEnvironmentPolicy=Enabled`) | Free |
| Service Bus | `pocpk-sb-si5fhs6dvxiha` | `pocpk-sb-si5fhs6dvxiha.servicebus.windows.net` | Standard |
| Key Vault | `ssd-pocpk-kv-dev-ae` | https://ssd-pocpk-kv-dev-ae.vault.azure.net/ | Standard |
| App Configuration | `ssd-pocpk-appcs-dev-ae` | https://ssd-pocpk-appcs-dev-ae.azconfig.io | Free |
| Container Apps Env | `ssd-pocpk-cae-dev-ae` | API + web **PR previews** | Consumption |
| Log Analytics | `ssd-pocpk-law-dev-ae` | Required by CAE | PerGB2018 |
| ACR | `ssdpocpkacrdevae` | `ssdpocpkacrdevae.azurecr.io` | Basic |
| Ephemeral ACA | `ssd-pocpk-aca-pr-<n>-ae` | created/deleted by `preview-api.yml` | Consumption |
| Ephemeral ACA (web) | `ssd-pocpk-aca-web-pr-<n>-ae` | created/deleted by `preview-web.yml` | Consumption |

Topics: `tenant.events`, `single-sign-on.events`, `permissions.events`, `subscriptions.events`, `contact.events`, `support.events`, `audit.events`, `reporting.events`, `notifications.events`. Consumers `audit` / `reporting` / `support` / `notifications` on publishing topics; trail consumers `audit` / `reporting` / `support` on `notifications.events`. Queue: `notifications.send` (explicit send commands).

### Secrets + configuration (locked)

| Layer | Store | Rule |
| --- | --- | --- |
| **Secrets** | Azure Key Vault `ssd-pocpk-kv-dev-ae` | Passwords, connection strings, SWA deploy token, ACR admin, Entra client secrets, notification provider keys. Never in git or GitHub Actions secrets. |
| **App configuration** | Azure App Configuration `ssd-pocpk-appcs-dev-ae` | Non-secret settings + **Key Vault references** for secret values (not inline secrets). |
| **CI/CD** | GitHub Actions **OIDC** -> Azure | Workflows log in with federated creds, then `az keyvault secret show` / App Config at **job runtime**. |

| Layer | Choice |
| --- | --- |
| AuthN + coarse roles | Entra via **SingleSignOn** (e.g. tenant-admin, support-agent) |
| Fine-grained authZ | **Permissions** pillar - `Check(subject, action, resource)` |
| Engine (PoC) | **OpenFGA** (Zanzibar/ReBAC) on **Azure Container Apps Consumption** |
| Avoid unless insisted | Auth0 FGA / Permit.io (extra vendor); flat SQL ACLs alone (harder to scale relationships) |

Other pillars call Permissions (sync HTTP or cache); never embed authZ rules in Contact/etc. Optional permission-denial events -> Audit.

**Key Vault secret names (not values):** `database-url`, `database-url-unpooled`, `servicebus-connection-string`, `swa-deployment-token`, `swa-marketing-deployment-token`, `acr-admin-username`, `acr-admin-password`, `acr-login-server`, `forwardemail-api-key`, `sms-gateway-username`, `sms-gateway-password`, `whatsapp-cloud-access-token`, `appinsights-connection-string`, `auth-secret`, `azure-ad-client-secret`, `chromatic-project-token`, `openfga-database-url`, `openfga-database-url-unpooled`

**Org devtools Key Vault** (`ssd-devtools-kv-prod-ae`, subscription Singleton SD — CI/provision only, not app runtime): `github-automation-pat` (org-wide platform automation PAT). See **Platform GitHub automation PAT** above.

**Entra / Auth.js (App Config -> Nest env):** plain `app:azureAd:clientId` / `tenantId` / `apiAudience`; KV refs `secret:auth-secret` -> `AUTH_SECRET`, `secret:azure-ad-client-secret` -> `AZURE_AD_CLIENT_SECRET`. Do not put these secrets on App Service app settings.

**Telemetry:** shared App Insights + LAW - see [`docs/telemetry.md`](docs/telemetry.md) / ClickUp Architecture Doc.

**GitHub Actions - allowed identifiers only (repository Variables, not Secrets):**

| Variable | Purpose |
| --- | --- |
| `AZURE_CLIENT_ID` | OIDC app registration application (client) ID |
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID (app resources; OIDC login default) |

App registration: `ssd-pocpk-gha-oidc-dev` with federated credentials. Prefer **ID-form** subjects (`repo:ORG@ORG_ID/REPO@REPO_ID:pull_request` / `:ref:refs/heads/main`); classic `repo:org/repo:...` subjects may remain for compatibility. **FIC subject must match JWT `sub` exactly.** Roles: **Reader** on RG (marketing SWA preview), **Contributor** on RG (ACA API + web preview deploy), **Website Contributor** on `pocpk-api-si5fhs6dvxiha` (`deploy-api.yml`), **Key Vault Secrets User** on `ssd-pocpk-kv-dev-ae` (app runtime), **Key Vault Secrets User** on `ssd-devtools-kv-prod-ae` (org CI secrets — cross-subscription), **App Configuration Data Reader**. ACR push uses OIDC -> KV `acr-admin-*` (not AcrPush / not GitHub Secrets).

**Do not** store `AZURE_STATIC_WEB_APPS_API_TOKEN`, `AZURE_CREDENTIALS`, connection strings, passwords, or deploy tokens in GitHub Secrets.

### Notifications pillar (locked)

| Channel | Provider | Adapter |
| --- | --- | --- |
| Email | [Forward Email API](https://forwardemail.net/en/email-api) | `EmailProvider` |
| SMS | [android-sms-gateway](https://github.com/capcom6/android-sms-gateway) | `SmsProvider` |
| WhatsApp | Meta WhatsApp Cloud API (default; swappable) | `WhatsAppProvider` |

Consumes domain events + queue `notifications.send`; publishes `notification.sent` / `notification.failed` on `notifications.events`. Non-secret App Config: provider base URLs, WhatsApp phone-number-id, Graph API version (secrets only as KV references).

### Marketing connectors (locked)

Decap `/admin` login uses shared [`cms-oauth-kit`](https://github.com/singleton-sd/cms-oauth-kit) at `https://auth.singletonsd.com`. The brochure Contact form uses shared [`PostKit`](https://github.com/singleton-sd/post-kit) through `PUBLIC_POSTKIT_API_BASE_URL`. Platform Kit does not deploy a marketing OAuth or email Function.

| Surface | Rule |
| --- | --- |
| Local | Pull from KV / App Config. Do not commit secrets. `.env` is optional gitignored cache. |
| GitHub Actions | OIDC -> Azure login -> Key Vault / App Config at runtime. |
| App Service / SWA / Container Apps | Prefer App Configuration provider + KV references for secrets. |

- [x] CLI identity can see the subscription
- [x] Core deploy succeeded - SQL, App Service, SWA Free, Service Bus Standard
- [x] Key Vault `ssd-pocpk-kv-dev-ae` provisioned; SQL/SB/SWA secrets in KV
