# SETUP — human checklist

## 1. GitHub

- [x] Repo exists: `https://github.com/singleton-sd/poc-plattform-kit` (SSH: `git@github-personal:singleton-sd/poc-plattform-kit.git`; personal remotes use the `github-personal` SSH host alias)
- [x] Push `main` from `C:\00Personal\singleton-sd\poc-plattform-kit`
- [ ] Branch protection on `main`: require PR, **require human approval**, disallow AI/bot merge if possible
- [ ] Optional ruleset for `feature/*` branch naming (see below)
- [ ] Connect repo in [Cursor Integrations](https://cursor.com/dashboard/integrations)

### Branch naming (agents + optional GitHub rules)

**Convention (primary — agents follow `AGENTS.md`):**

```
feature/<clickup-task-id>-<kebab-title>
```

Example: `feature/86dxxxx-prisma-azure-sql`

**Where to click in GitHub (optional enforcement):**

1. Open the repo → **Settings** → **Rules** → **Rulesets** (or **Branches** for classic branch protection).
2. **Protect `main`:** New ruleset targeting `refs/heads/main` — require a pull request before merging, require at least one **human** approving review, block force pushes and deletions, disallow direct pushes to `main`.
3. **Optional `feature/*` pattern:** New ruleset targeting `refs/heads/feature/*` (and/or restrict which refs can be created). Branch name patterns in rulesets can limit create/push depending on GitHub plan; they do not always force the create pattern globally. Prefer documenting the convention in `AGENTS.md` and using rulesets as a safety net.
4. Ensure PRs into `main` come from feature/hotfix branches only (agents never merge; humans approve).

## 2. ClickUp (workspace `90161394355`) — locked locations

- **Tickets list (only):** https://app.clickup.com/90161394355/v/li/901616287298 (`901616287298`) in space PoC
- **Architecture Doc:** https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- **Decisions / Docs folder:** https://app.clickup.com/90161394355/v/f/901610744236/90165834867 (`folder_id=901610744236`)
- Do **not** create a new Platform Kit space/list
- Statuses already on the list: **TO DO**, **IN PROGRESS**, **READY FOR AI**, **READY FOR REVIEW**, **READY FOR HUMAN**, **COMPLETE**
- Ticket template includes `[repo=singleton-sd/poc-plattform-kit]`, acceptance criteria, tests
- [ ] Connect ClickUp ↔ Cursor (App Center + Cursor API key); default repo = this GitHub repo

## 3. Agent automations

- [ ] Implementer: pick tickets in **READY FOR AI** → **assign self** (`assignees: ["me"]`) → **IN PROGRESS** → PR → **READY FOR REVIEW**
- [ ] Reviewer: pick tickets in **READY FOR REVIEW** → **assign self** for the review phase (comment prior implementer if they must stay visible) → **READY FOR HUMAN**
- [ ] Assignment only when claiming work — not when browsing
- [ ] Humans only: merge PR when **READY FOR HUMAN**, then set **COMPLETE**

## 4. Azure

**Subscription:** **ssd-poc-plattform-kit** / `7b8343d7-969f-4b71-8864-b7925e7fae30`  
**Tenant:** `9a0e57d7-e58e-4e8b-814d-037cd7d9015c`  
**Resource group:** `rg-poc-plattform-kit` (region `australiaeast`; SWA Free in `eastasia`)  
**IaC:** [`infra/`](./infra/) — `powershell -File ./infra/deploy.ps1`

### Locked: cost + naming

- **Cost:** cheapest SKUs that still work — SQL **Basic**, App Service **F1 Free** (B1 only if needed), SWA **Free**, Service Bus **Standard** (topics; not Premium), Key Vault **Standard**.
- **Naming (new resources):** CAF `{org}-{app}-{resource}-{env}-{region}` → e.g. `ssd-pocpk-kv-dev-ae`.
- **Legacy live names** (`pocpk-*-si5fhs6dvxiha`) stay as-is (renames recreate). See alias table in [`infra/README.md`](./infra/README.md).

### Provisioned (2026-08-04)

| Kind | Name | URL / notes | SKU |
| --- | --- | --- | --- |
| SQL Server / DB | `pocpk-sql-si5fhs6dvxiha` / `pocpk` | `pocpk-sql-si5fhs6dvxiha.database.windows.net` | Basic |
| App Service Plan + API | `pocpk-plan` / `pocpk-api-si5fhs6dvxiha` | https://pocpk-api-si5fhs6dvxiha.azurewebsites.net | F1 Free |
| Static Web App | `pocpk-web-si5fhs6dvxiha` | https://kind-rock-0f409fe00.7.azurestaticapps.net | Free |
| Service Bus | `pocpk-sb-si5fhs6dvxiha` | `pocpk-sb-si5fhs6dvxiha.servicebus.windows.net` | Standard |
| Key Vault | `ssd-pocpk-kv-dev-ae` | https://ssd-pocpk-kv-dev-ae.vault.azure.net/ | Standard |

Topics: `tenant.events`, `single-sign-on.events`, `permissions.events`, `subscriptions.events`, `contact.events`, `support.events`, `audit.events`, `reporting.events`, `notifications.events`. Consumers `audit` / `reporting` / `support` / `notifications` on publishing topics; trail consumers `audit` / `reporting` / `support` on `notifications.events`. Queue: `notifications.send` (explicit send commands).

### AuthZ: Permissions pillar (locked)

Azure does **not** offer a first-class app-data authZ service for “user X / action Y / resource Z” on domain items (Azure RBAC / Entra app roles are Azure resources + coarse app roles only).

| Layer | Choice |
| --- | --- |
| AuthN + coarse roles | Entra via **SingleSignOn** (e.g. tenant-admin, support-agent) |
| Fine-grained authZ | **Permissions** pillar — `Check(subject, action, resource)` |
| Engine (PoC) | **OpenFGA** (Zanzibar/ReBAC) on **Azure Container Apps Consumption** |
| Avoid unless insisted | Auth0 FGA / Permit.io (extra vendor); flat SQL ACLs alone (harder to scale relationships) |

Other pillars call Permissions (sync HTTP or cache); never embed authZ rules in Contact/etc. Optional permission-denial events → Audit.

### Secrets: Azure Key Vault (locked)

**Vault:** `ssd-pocpk-kv-dev-ae`  
**Secret names (not values):** `sql-admin-password`, `database-url`, `servicebus-connection-string`, `forwardemail-api-key`, `sms-gateway-username`, `sms-gateway-password`, `whatsapp-cloud-access-token`  
*(Later after Entra: `auth-secret`, `azure-ad-client-secret`, …)*

**Non-secret config:** Azure App Configuration `ssd-pocpk-appcs-dev-ae` (provider base URLs, WhatsApp phone-number-id, Graph API version). Secrets appear only as **Key Vault references** in App Config — never inline.

### Notifications pillar (locked)

| Channel | Provider | Adapter |
| --- | --- | --- |
| Email | [Forward Email API](https://forwardemail.net/en/email-api) | `EmailProvider` |
| SMS | [android-sms-gateway](https://github.com/capcom6/android-sms-gateway) | `SmsProvider` |
| WhatsApp | Meta WhatsApp Cloud API (default; swappable) | `WhatsAppProvider` |

Consumes domain events + queue `notifications.send`; publishes `notification.sent` / `notification.failed` on `notifications.events`.

| Surface | Rule |
| --- | --- |
| Local | Pull from KV. Do not commit secrets. `.env` is optional gitignored cache. |
| GitHub Actions | OIDC → fetch from KV. |
| App Service / SWA | Key Vault references for app settings where possible. |

- [x] CLI identity can see the subscription
- [x] Core deploy succeeded — SQL, App Service (F1), SWA Free, Service Bus Standard
- [x] Key Vault `ssd-pocpk-kv-dev-ae` provisioned; SQL/SB secrets migrated from `.env`
- [x] Local `.env` written by deploy (gitignored); `.env.example` has placeholders
- [ ] Entra app registration (SPA + API) — secrets in KV
- [ ] Tighten SQL firewall (`AllowAllDevPoC` → your IP)
- [ ] GitHub Actions OIDC → Key Vault; App Service/SWA use KV references
- [ ] Connect SWA ↔ GitHub for deploys
- [ ] Confirm Nest runs acceptably on F1; bump to B1 only if Free is insufficient

## 5. Skills

Curated skills are committed under `.cursor/skills/`. Refresh from local source:

```powershell
pnpm sync:skills
```

Source: `C:\00Personal\singleton-sd\ai-plattform\skills` (also on GitHub `singleton-sd/ai-plattform-skills`).
