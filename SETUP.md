# SETUP â€” human checklist

## 1. GitHub

- [x] Repo exists: `https://github.com/singleton-sd/poc-plattform-kit` (SSH: `git@github-personal:singleton-sd/poc-plattform-kit.git`; personal remotes use the `github-personal` SSH host alias)
- [x] Push `main` from `C:\00Personal\singleton-sd\poc-plattform-kit`
- [ ] Branch protection on `main` (solo-repo policy â€” see below)
- [ ] Optional ruleset for `feature/*` branch naming (see below)
- [ ] Connect repo in [Cursor Integrations](https://cursor.com/dashboard/integrations)

### Solo-repo branch protection (locked)

This is a **solo** GitHub identity repo. GitHub forbids self-approve, so **do not** require approving reviews.

**Protect `main`:**

1. Open the repo â†’ **Settings** â†’ **Rules** â†’ **Rulesets** (or classic **Branches**).
2. Require a pull request before merging; **require status checks** (CI workflows) to pass.
3. **Do not** require approving reviews (blocks the same human/AI identity that authored the PR).
4. Block force pushes and deletions; disallow direct pushes to `main`.
5. **Human merge only** â€” agents never merge. AI reviews are **comments only** when the reviewer shares the authorâ€™s GitHub identity.

### Branch naming (agents + optional GitHub rules)

**Convention (primary â€” agents follow `AGENTS.md`):**

```
feature/<clickup-task-id>-<kebab-title>
```

Example: `feature/86dxxxx-prisma-azure-sql`

**Where to click in GitHub (optional enforcement):**

1. Open the repo â†’ **Settings** â†’ **Rules** â†’ **Rulesets**.
2. **Protect `main`:** as above (CI + human merge; no required approvals).
3. **Optional `feature/*` pattern:** New ruleset targeting `refs/heads/feature/*`. Prefer documenting the convention in `AGENTS.md` and using rulesets as a safety net.
4. Ensure PRs into `main` come from feature/hotfix branches only (agents never merge; humans merge).

## 2. ClickUp (workspace `90161394355`) â€” locked locations

- **Tickets list (only):** https://app.clickup.com/90161394355/v/li/901616287298 (`901616287298`) in space PoC
- **Architecture Doc:** https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- **Decisions / Docs folder:** https://app.clickup.com/90161394355/v/f/901610744236/90165834867 (`folder_id=901610744236`)
- Do **not** create a new Platform Kit space/list
- Statuses already on the list: **TO DO**, **IN PROGRESS**, **READY FOR AI**, **READY FOR REVIEW**, **READY FOR HUMAN**, **COMPLETE**
- Ticket template includes `[repo=singleton-sd/poc-plattform-kit]`, acceptance criteria, tests
- [ ] Connect ClickUp â†” Cursor (App Center + Cursor API key); default repo = this GitHub repo

## 3. Agent automations

- [ ] Implementer: pick tickets in **READY FOR AI** â†’ **assign self** (`assignees: ["me"]`) â†’ **IN PROGRESS** â†’ PR â†’ **PR hygiene** (CI + mergeable) â†’ **READY FOR REVIEW**
- [ ] Reviewer: pick tickets in **READY FOR REVIEW** â†’ **assign self** for the review phase (comment prior implementer if they must stay visible) â†’ post review **comments** â†’ hygiene (mergeable + CI + Bugbot/human feedback) â†’ **READY FOR HUMAN**
- [ ] Assignment only when claiming work â€” not when browsing
- [ ] Humans only: merge PR when **READY FOR HUMAN**, then set **COMPLETE**
- [ ] PR hygiene labels (`needs-rebase`, `ci-failed`, `has-feedback`) from `.github/workflows/pr-hygiene.yml` â€” see `docs/pr-pipelines.md` / `AGENTS.md`

## 4. Azure

**Subscription:** **ssd-poc-plattform-kit** / `7b8343d7-969f-4b71-8864-b7925e7fae30`  
**Tenant:** `9a0e57d7-e58e-4e8b-814d-037cd7d9015c`  
**Resource group:** `rg-poc-plattform-kit` (region `australiaeast`; SWA Free in `eastasia`)  
**IaC:** [`infra/`](./infra/) â€” `powershell -File ./infra/deploy.ps1`

### Locked: cost + naming

- **Cost:** cheapest SKUs that still work â€” SQL **Basic**, App Service **B1** (custom-domain HTTPS + Nest always-on), SWA **Free** Ã—2 (app + marketing), Service Bus **Standard** (topics; not Premium), Key Vault **Standard**, App Configuration **Free**, ACR **Basic**, Container Apps **Consumption** (API PR previews + OpenFGA).
- **Naming (new resources):** CAF `{org}-{app}-{resource}-{env}-{region}` â†’ e.g. `ssd-pocpk-kv-dev-ae`, `ssd-pocpk-appcs-dev-ae`, `ssd-pocpk-mkt-dev-ae`. ACR is alphanumeric-only: `ssdpocpkacrdevae`.
- **Legacy live names** (`pocpk-*-si5fhs6dvxiha`) stay as-is (renames recreate). See alias table in [`infra/README.md`](./infra/README.md).

### Custom domains (locked) â€” DNS in AWS Route53

Public hostnames under `singletonsd.com` (DNS stays in **AWS**; Azure only gets CNAMEs / validation TXT):

| Hostname | Surface | Azure target |
| --- | --- | --- |
| `plattform-kit.poc.singletonsd.com` | Marketing | SWA `ssd-pocpk-mkt-dev-ae` (Free) |
| `app.plattform-kit.poc.singletonsd.com` | Web app (PWA/SPA) | SWA `pocpk-web-si5fhs6dvxiha` (Free) |
| `api.plattform-kit.poc.singletonsd.com` | Nest API | App Service `pocpk-api-si5fhs6dvxiha` (**B1**) |

PR / preview URLs stay on Azure defaults (`*.azurestaticapps.net`, ACA preview hostnames) â€” no custom preview domains.

#### Route53 checklist (zone `singletonsd.com` or delegated `poc.singletonsd.com`)

After Azure default hostnames are known (see provisioned table / `az` outputs):

| Record | Type | Value |
| --- | --- | --- |
| `plattform-kit.poc` | CNAME | marketing SWA default hostname |
| `app.plattform-kit.poc` | CNAME | web SWA default hostname (e.g. `kind-rock-â€¦.azurestaticapps.net`) |
| `api.plattform-kit.poc` | CNAME | `pocpk-api-si5fhs6dvxiha.azurewebsites.net` |
| (as prompted by Azure) | TXT | SWA / App Service domain validation |

Then bind custom domains + managed certs in Azure (`az staticwebapp hostname set`, App Service managed certificate). Do **not** move the zone to Azure DNS.

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
| App Service Plan + API | `pocpk-plan` / `pocpk-api-si5fhs6dvxiha` | https://api.plattform-kit.poc.singletonsd.com (default: `â€¦.azurewebsites.net`) | **B1** |
| Static Web App (app) | `pocpk-web-si5fhs6dvxiha` | https://app.plattform-kit.poc.singletonsd.com (default: `â€¦.azurestaticapps.net`) | Free |
| Static Web App (marketing) | `ssd-pocpk-mkt-dev-ae` | https://plattform-kit.poc.singletonsd.com | Free |
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
| **Secrets** | Azure Key Vault `ssd-pocpk-kv-dev-ae` | Passwords, connection strings, SWA deploy token, ACR admin, Entra client secrets, notification provider keys. **Never** in git or GitHub Actions secrets. |
| **App configuration** | Azure App Configuration `ssd-pocpk-appcs-dev-ae` | Non-secret settings + **Key Vault references** for secret values (not inline secrets). |
| **CI/CD** | GitHub Actions **OIDC** â†’ Azure | Workflows log in with federated creds, then `az keyvault secret show` / App Config at **job runtime**. |

| Layer | Choice |
| --- | --- |
| AuthN + coarse roles | Entra via **SingleSignOn** (e.g. tenant-admin, support-agent) |
| Fine-grained authZ | **Permissions** pillar â€” `Check(subject, action, resource)` |
| Engine (PoC) | **OpenFGA** (Zanzibar/ReBAC) on **Azure Container Apps Consumption** |
| Avoid unless insisted | Auth0 FGA / Permit.io (extra vendor); flat SQL ACLs alone (harder to scale relationships) |

Other pillars call Permissions (sync HTTP or cache); never embed authZ rules in Contact/etc. Optional permission-denial events â†’ Audit.

**Key Vault secret names (not values):** `sql-admin-password`, `database-url`, `servicebus-connection-string`, `swa-deployment-token`, `swa-marketing-deployment-token`, `acr-admin-username`, `acr-admin-password`, `acr-login-server`, `forwardemail-api-key`, `sms-gateway-username`, `sms-gateway-password`, `whatsapp-cloud-access-token`, `appinsights-connection-string`
*(Later after Entra: `auth-secret`, `azure-ad-client-secret`, â€¦)*

**Telemetry:** shared App Insights + LAW â€” see [`docs/telemetry.md`](docs/telemetry.md) / ClickUp Architecture Doc.

**GitHub Actions â€” allowed identifiers only (repository Variables, not Secrets):**

| Variable | Purpose |
| --- | --- |
| `AZURE_CLIENT_ID` | OIDC app registration application (client) ID |
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |

App registration: `ssd-pocpk-gha-oidc-dev` with federated credentials. Prefer **ID-form** subjects (`repo:ORG@ORG_ID/REPO@REPO_ID:pull_request` / `:ref:refs/heads/main`); classic `repo:org/repo:...` subjects may remain for compatibility. **FIC subject must match JWT `sub` exactly.** Roles: **Reader** on RG (SWA preview), **Contributor** on RG (ACA preview deploy), **Website Contributor** on `pocpk-api-si5fhs6dvxiha` (`deploy-api.yml`), **Key Vault Secrets User**, **App Configuration Data Reader**. ACR push uses OIDC â†’ KV `acr-admin-*` (not AcrPush / not GitHub Secrets).

**Do not** store `AZURE_STATIC_WEB_APPS_API_TOKEN`, `AZURE_CREDENTIALS`, connection strings, passwords, or deploy tokens in GitHub Secrets.

### Notifications pillar (locked)

| Channel | Provider | Adapter |
| --- | --- | --- |
| Email | [Forward Email API](https://forwardemail.net/en/email-api) | `EmailProvider` |
| SMS | [android-sms-gateway](https://github.com/capcom6/android-sms-gateway) | `SmsProvider` |
| WhatsApp | Meta WhatsApp Cloud API (default; swappable) | `WhatsAppProvider` |

Consumes domain events + queue `notifications.send`; publishes `notification.sent` / `notification.failed` on `notifications.events`. Non-secret App Config: provider base URLs, WhatsApp phone-number-id, Graph API version (secrets only as KV references).

| Surface | Rule |
| --- | --- |
| Local | Pull from KV / App Config. Do not commit secrets. `.env` is optional gitignored cache. |
| GitHub Actions | OIDC â†’ Azure login â†’ Key Vault / App Config at runtime. |
| App Service / SWA / Container Apps | Prefer App Configuration provider + KV references for secrets. |

- [x] CLI identity can see the subscription
- [x] Core deploy succeeded â€” SQL, App Service, SWA Free, Service Bus Standard
- [x] Key Vault `ssd-pocpk-kv-dev-ae` provisioned; SQL/SB/SWA secrets in KV
- [x] App Configuration `ssd-pocpk-appcs-dev-ae` (Free) + KV references seeded
- [x] GitHub OIDC app + federated credentials + Variables set; **no** deploy tokens in GitHub Secrets
- [x] Local `.env` written by deploy (gitignored); `.env.example` has placeholders
- [x] `deploy-aca-preview.ps1` â€” CAE + ACR Basic + LAW + KV ACR secrets
- [x] App Service plan **B1** + always-on (custom-domain HTTPS ready)
- [x] Marketing SWA `ssd-pocpk-mkt-dev-ae` provisioned; App Config public URL keys seeded
- [x] Route53 CNAMEs/TXT (AWS) â€” applied; re-run via `scripts/apply-route53-dns.ps1`
- [x] Custom domains + managed certs bound â€” re-run via `scripts/bind-custom-domains.ps1`
- [x] Reusable domain config `infra/custom-domains.pocpk.json` (+ schema) for other products
- [ ] Entra app registration (SPA + API) â€” secrets in KV; config keys in App Config
- [ ] API `/health` on custom domain returns 200 (currently 503 â€” app runtime, not DNS/TLS)
- [ ] Tighten SQL firewall (`AllowAllDevPoC` â†’ your IP)
- [ ] Wire App Service / SWA / ACA to App Configuration provider + managed identity
- [x] Confirm OIDC app has **Contributor** on RG + **Key Vault Secrets User** (ACR push uses KV `acr-admin-*`, not AcrPush)
- [x] Grant **Website Contributor** on `pocpk-api-si5fhs6dvxiha` to `ssd-pocpk-gha-oidc-dev` (needed once for `deploy-api.yml`)
- [ ] ~~S1 slots for API PR previews~~ â€” **deprecated**; use Container Apps Path B


### OIDC bootstrap (if Variables missing / admin consent)

1. App registration `ssd-pocpk-gha-oidc-dev` already created in tenant `9a0e57d7-e58e-4e8b-814d-037cd7d9015c`.
2. Federated credentials (issuer `https://token.actions.githubusercontent.com`). **Entra FIC `subject` must match the JWT `sub` exactly.**
   - **ID-form (current GitHub default for many orgs):** `repo:ORG@ORG_ID/REPO@REPO_ID:pull_request` and `repo:ORG@ORG_ID/REPO@REPO_ID:ref:refs/heads/main` (numeric org/repo IDs). Example shape: `repo:singleton-sd@NNNN/poc-plattform-kit@MMMM:pull_request`.
   - **Classic (optional compatibility):** keep `repo:singleton-sd/poc-plattform-kit:pull_request` and `repo:singleton-sd/poc-plattform-kit:ref:refs/heads/main` if tokens still emit that form.
   - Tip: decode a failed job's OIDC token / check the Azure login error for the exact `sub`, then set FIC subjects to match (both forms can coexist on the app registration).
3. Ensure repo **Variables** `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` match the app/sub/tenant.
4. If login fails with consent errors: Entra admin grants the enterprise app access (tenant admin consent for the SP) â€” Portal â†’ Enterprise applications â†’ `ssd-pocpk-gha-oidc-dev` â†’ Permissions / admin consent, or re-run role assignments as subscription Owner.
5. SWA deploy token lives only in KV as `swa-deployment-token` (`az staticwebapp secrets list` â†’ `az keyvault secret set`).
6. ACR admin username/password live only in KV as `acr-admin-*` (written by `deploy-aca-preview.ps1`).
7. For App Service zip deploy (`deploy-api.yml`), grant the OIDC SP Website Contributor on the web app:

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
| `preview-web.yml` | `apps/web/**`, `packages/**` | SWA **PR preview** via OIDC â†’ KV token |
| `preview-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | **ACA** ephemeral `ssd-pocpk-aca-pr-<n>-ae` |
| `deploy-web.yml` | same as ci-web, **`push` `main`** | SWA **production** via OIDC â†’ KV |
| `deploy-api.yml` | same as ci-api, **`push` `main`** (+ `workflow_dispatch`) | Nest â†’ App Service **B1** via OIDC (prebuilt `dist`; Oryx off) |
| `deploy-marketing.yml` | `apps/marketing/**`, **`push` `main`** | Marketing SWA production via OIDC â†’ KV |

- **FE-only PRs** skip API CI; **API-only** skip web CI; **`packages/**`** runs both.
- **FE preview:** SWA Free PR environments; token from Key Vault at runtime (OIDC). If OIDC Variables are unset, deploy **skips** (non-blocking).
- **Production on merge:** `deploy-web.yml` / `deploy-api.yml` publish to the live SWA hostname and App Service URL (same OIDC skip behaviour).
- **API zip deploy:** keep `SCM_DO_BUILD_DURING_DEPLOYMENT=false` + `ENABLE_ORYX_BUILD=false` on the web app (Bicep). Do **not** change app settings in the same job as zip deploy (SCM restart aborts deploy). Package with `pnpm --filter @poc-plattform-kit/api deploy --prod`, then `rsync -aL` to dereference pnpm symlinks (Kuduâ€™s `node_modules.tar.gz` extract otherwise breaks nested deps like `tslib`), then `az webapp deploy --type zip` async. Do **not** zip the whole monorepo `node_modules` (~746MB â†’ Kudu **504** on B1).
- **BE preview (Path B locked):** Container Apps Consumption per PR (scale to zero). F1 stays prod/dev only. Shared F1 overwrite and S1 slots rejected/deprecated for per-PR need. OIDC Variables â†’ KV ACR secrets â€” never GitHub secret tokens / `AZURE_CREDENTIALS`. Re-run `powershell -File ./infra/deploy-aca-preview.ps1` is idempotent.
- Branch naming: `feature/<clickup-task-id>-<kebab-title>`. **Humans only** merge PRs.

## 6. Skills

Curated skills are committed under `.cursor/skills/`. Refresh from local source:

```powershell
pnpm sync:skills
```

Source: `C:\00Personal\singleton-sd\ai-plattform\skills` (also on GitHub `singleton-sd/ai-plattform-skills`).
