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

### Branch naming (agents + optional GitHub rules)

**Convention (primary - agents follow `AGENTS.md`):**

```
feature/<clickup-task-id>-<kebab-title>
```

Example: `feature/86dxxxx-prisma-azure-sql`

**Workspace layout (locked):** open a parent folder in Cursor that contains the clone and ticket worktrees:

```text
plattform-kit/                 <-- Open this
  repo/                        <-- git clone (main only)
  worktrees/<id>-<kebab-slug>/
```

Create worktrees with `pnpm worktree:add -- -TaskId <id> -Slug <kebab>` (see `AGENTS.md`). Do not create `poc-plattform-kit-wt-*` siblings next to other projects.

**Where to click in GitHub (optional enforcement):**

1. Open the repo -> **Settings** -> **Rules** -> **Rulesets**.
2. **Protect `main`:** as above (CI + human merge; no required approvals).
3. **Optional `feature/*` pattern:** New ruleset targeting `refs/heads/feature/*`. Prefer documenting the convention in `AGENTS.md` and using rulesets as a safety net.
4. Ensure PRs into `main` come from feature/hotfix branches only (agents never merge; humans merge).

## 2. ClickUp (workspace `90161394355`) - locked locations

- **Tickets list (only):** https://app.clickup.com/90161394355/v/li/901616287298 (`901616287298`) in space PoC
- **Architecture Doc:** https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- **Decisions / Docs folder:** https://app.clickup.com/90161394355/v/f/901610744236/90165834867 (`folder_id=901610744236`)
- Do not create a new Platform Kit space/list
- Statuses already on the list: **TO DO**, **IN PROGRESS**, **READY FOR AI**, **READY FOR REVIEW**, **READY FOR HUMAN**, **COMPLETE**
- Ticket template includes `[repo=singleton-sd/poc-plattform-kit]`, acceptance criteria, tests
- [ ] Connect ClickUp -> Cursor (App Center + Cursor API key); default repo = this GitHub repo

## 3. Agent automations

- [x] Agents use REST [`scripts/clickup.ps1`](scripts/clickup.ps1) + `CLICKUP_API_TOKEN` (not ClickUp MCP for routine ops)
- [ ] Implementer: pick tickets in **READY FOR AI** -> claim via `scripts/clickup.ps1 claim` -> **IN PROGRESS** -> PR -> **PR hygiene** (CI + mergeable) -> **READY FOR REVIEW**
- [ ] Review bots: inspect PRs in **READY FOR REVIEW** and leave findings on GitHub; agents do not claim tickets for review
- [ ] Human: follow the PR test plan, leave feature feedback, and merge only after CI and actionable bot findings are resolved
- [ ] Assignment / Claim Token only when claiming work - not when browsing
- [x] Merge automation: merged task branches set ClickUp to **COMPLETE** via OIDC -> Key Vault (`clickup-api-token`) -> ClickUp REST
- [ ] PR hygiene labels (`needs-rebase`, `ci-failed`, `has-feedback`) from `.github/workflows/pr-hygiene.yml` - see `docs/pr-pipelines.md` / `AGENTS.md`

## 4. Azure

**Subscription:** **ssd-poc-plattform-kit** / `7b8343d7-969f-4b71-8864-b7925e7fae30`  
**Tenant:** `9a0e57d7-e58e-4e8b-814d-037cd7d9015c`  
**Resource group:** `rg-poc-plattform-kit` (region `australiaeast`; SWA Free in `eastasia`)  
**IaC:** [`infra/`](./infra/) - `powershell -File ./infra/deploy.ps1`

### Locked: cost + naming

- **Cost:** cheapest SKUs that still work - SQL **Basic**, App Service **B1** (custom-domain HTTPS + Nest always-on), SWA **Free** x2 (app + marketing), Service Bus **Standard** (topics; not Premium), Key Vault **Standard**, App Configuration **Free**, ACR **Basic**, Container Apps **Consumption** (API PR previews + OpenFGA).
- **Naming (new resources):** CAF `{org}-{app}-{resource}-{env}-{region}` -> e.g. `ssd-pocpk-kv-dev-ae`, `ssd-pocpk-appcs-dev-ae`, `ssd-pocpk-mkt-dev-ae`. ACR is alphanumeric-only: `ssdpocpkacrdevae`.
- **Legacy live names** (`pocpk-*-si5fhs6dvxiha`) stay as-is (renames recreate). See alias table in [`infra/README.md`](./infra/README.md).

### Custom domains (locked) - DNS in AWS Route53

Public hostnames under `singletonsd.com` (DNS stays in **AWS**; Azure only gets CNAMEs / validation TXT):

| Hostname | Surface | Azure target |
| --- | --- | --- |
| `plattform-kit.poc.singletonsd.com` | Marketing | SWA `ssd-pocpk-mkt-dev-ae` (Free) |
| `app.plattform-kit.poc.singletonsd.com` | Web app (PWA/SPA) | SWA `pocpk-web-si5fhs6dvxiha` (Free) |
| `api.plattform-kit.poc.singletonsd.com` | Nest API | App Service `pocpk-api-si5fhs6dvxiha` (**B1**) |

PR / preview URLs stay on Azure defaults (`*.azurestaticapps.net`, ACA preview hostnames) - no custom preview domains. API CORS / Auth.js redirects allow this repo's SWA instance prefixes (`https://kind-rock-0f409fe00*.azurestaticapps.net`, marketing SWA likewise) via `CORS_ORIGINS` / App Config `app:cors:origins` (see [docs/sso.md](./docs/sso.md)). Entra Auth.js callback stays on the API host; MSAL SPA redirect URIs need exact preview origins (no Entra wildcard).

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
| SQL Server / DB | `pocpk-sql-si5fhs6dvxiha` / `pocpk` | `pocpk-sql-si5fhs6dvxiha.database.windows.net` | Basic |
| App Service Plan + API | `pocpk-plan` / `pocpk-api-si5fhs6dvxiha` | https://api.plattform-kit.poc.singletonsd.com (default: `....azurewebsites.net`) | **B1** |
| Static Web App (app) | `pocpk-web-si5fhs6dvxiha` | https://app.plattform-kit.poc.singletonsd.com (default: `....azurestaticapps.net`) | Free |
| Static Web App (marketing) | `ssd-pocpk-mkt-dev-ae` | https://plattform-kit.poc.singletonsd.com (PR previews need `stagingEnvironmentPolicy=Enabled`) | Free |
| Service Bus | `pocpk-sb-si5fhs6dvxiha` | `pocpk-sb-si5fhs6dvxiha.servicebus.windows.net` | Standard |
| Key Vault | `ssd-pocpk-kv-dev-ae` | https://ssd-pocpk-kv-dev-ae.vault.azure.net/ | Standard |
| App Configuration | `ssd-pocpk-appcs-dev-ae` | https://ssd-pocpk-appcs-dev-ae.azconfig.io | Free |
| Container Apps Env | `ssd-pocpk-cae-dev-ae` | API **PR previews** | Consumption |
| Log Analytics | `ssd-pocpk-law-dev-ae` | Required by CAE | PerGB2018 |
| ACR | `ssdpocpkacrdevae` | `ssdpocpkacrdevae.azurecr.io` | Basic |
| Ephemeral ACA | `ssd-pocpk-aca-pr-<n>-ae` | created/deleted by `preview-api.yml` | Consumption |

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

**Key Vault secret names (not values):** `sql-admin-password`, `database-url`, `servicebus-connection-string`, `swa-deployment-token`, `swa-marketing-deployment-token`, `acr-admin-username`, `acr-admin-password`, `acr-login-server`, `forwardemail-api-key`, `sms-gateway-username`, `sms-gateway-password`, `whatsapp-cloud-access-token`, `appinsights-connection-string`, `auth-secret`, `azure-ad-client-secret`, `github-decap-oauth-client-secret`, `chromatic-project-token`

**Entra / Auth.js (App Config -> Nest env):** plain `app:azureAd:clientId` / `tenantId` / `apiAudience`; KV refs `secret:auth-secret` -> `AUTH_SECRET`, `secret:azure-ad-client-secret` -> `AZURE_AD_CLIENT_SECRET`. Do not put these secrets on App Service app settings.

**Telemetry:** shared App Insights + LAW - see [`docs/telemetry.md`](docs/telemetry.md) / ClickUp Architecture Doc.

**GitHub Actions - allowed identifiers only (repository Variables, not Secrets):**

| Variable | Purpose |
| --- | --- |
| `AZURE_CLIENT_ID` | OIDC app registration application (client) ID |
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |

App registration: `ssd-pocpk-gha-oidc-dev` with federated credentials. Prefer **ID-form** subjects (`repo:ORG@ORG_ID/REPO@REPO_ID:pull_request` / `:ref:refs/heads/main`); classic `repo:org/repo:...` subjects may remain for compatibility. **FIC subject must match JWT `sub` exactly.** Roles: **Reader** on RG (SWA preview), **Contributor** on RG (ACA preview deploy), **Website Contributor** on `pocpk-api-si5fhs6dvxiha` (`deploy-api.yml`), **Key Vault Secrets User**, **App Configuration Data Reader**. ACR push uses OIDC -> KV `acr-admin-*` (not AcrPush / not GitHub Secrets).

**Do not** store `AZURE_STATIC_WEB_APPS_API_TOKEN`, `AZURE_CREDENTIALS`, connection strings, passwords, or deploy tokens in GitHub Secrets.

### Notifications pillar (locked)

| Channel | Provider | Adapter |
| --- | --- | --- |
| Email | [Forward Email API](https://forwardemail.net/en/email-api) | `EmailProvider` |
| SMS | [android-sms-gateway](https://github.com/capcom6/android-sms-gateway) | `SmsProvider` |
| WhatsApp | Meta WhatsApp Cloud API (default; swappable) | `WhatsAppProvider` |

Consumes domain events + queue `notifications.send`; publishes `notification.sent` / `notification.failed` on `notifications.events`. Non-secret App Config: provider base URLs, WhatsApp phone-number-id, Graph API version (secrets only as KV references).

### Marketing edge (locked)

Public brochure HTTP (Contact form, etc.) runs on Function App **`ssd-pocpk-decap-oauth-dev-ae`** (`apps/marketing-oauth`), **not** Nest `apps/api`. See [`docs/marketing-edge.md`](docs/marketing-edge.md).

**Forward Email - create secret + App Config (ops; do not commit values):**

```powershell
az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30

# 1) Key Vault secret (prompt avoids shell history)
az keyvault secret set `
  --vault-name ssd-pocpk-kv-dev-ae `
  --name forwardemail-api-key `
  --file -   # paste token, Enter, then Ctrl+Z Enter on Windows - or use --value only in a private session

# Prefer interactive file/stdin. Example with env var you set yourself (not committed):
# $env:FORWARDEMAIL_API_KEY = '<paste once>'
# az keyvault secret set --vault-name ssd-pocpk-kv-dev-ae --name forwardemail-api-key --value $env:FORWARDEMAIL_API_KEY
# Remove-Item Env:FORWARDEMAIL_API_KEY

# 2) App Config Key Vault reference (same content-type as other secret:* keys)
az appconfig kv set `
  --name ssd-pocpk-appcs-dev-ae `
  --key secret:forwardemail-api-key `
  --content-type "application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8" `
  --value '{\"uri\": \"https://ssd-pocpk-kv-dev-ae.vault.azure.net/secrets/forwardemail-api-key\"}' `
  --yes

# 3) Non-secret contact delivery settings
az appconfig kv set --name ssd-pocpk-appcs-dev-ae --key app:notifications:forwardEmailBaseUrl --value "https://api.forwardemail.net" --yes
az appconfig kv set --name ssd-pocpk-appcs-dev-ae --key app:notifications:contactInboxEmail --value "hello@singletonsd.com" --yes
az appconfig kv set --name ssd-pocpk-appcs-dev-ae --key app:notifications:contactFromEmail --value "noreply@mail.plattform-kit.poc.singletonsd.com" --yes
```

Verify (no secret values printed):

```powershell
az keyvault secret show --vault-name ssd-pocpk-kv-dev-ae --name forwardemail-api-key --query "{name:name, enabled:attributes.enabled}" -o json
az appconfig kv show --name ssd-pocpk-appcs-dev-ae --key secret:forwardemail-api-key --query "{key:key, contentType:contentType}" -o json
```

| Surface | Rule |
| --- | --- |
| Local | Pull from KV / App Config. Do not commit secrets. `.env` is optional gitignored cache. |
| GitHub Actions | OIDC -> Azure login -> Key Vault / App Config at runtime. |
| App Service / SWA / Container Apps | Prefer App Configuration provider + KV references for secrets. |

- [x] CLI identity can see the subscription
- [x] Core deploy succeeded - SQL, App Service, SWA Free, Service Bus Standard
- [x] Key Vault `ssd-pocpk-kv-dev-ae` provisioned; SQL/SB/SWA secrets in KV
