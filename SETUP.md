# SETUP — human checklist

## 1. GitHub

- [x] Repo exists: `https://github.com/singleton-sd/poc-plattform-kit` (SSH: `git@github-personal:singleton-sd/poc-plattform-kit.git`; personal remotes use the `github-personal` SSH host alias)
- [x] Push `main` from `C:\00Personal\singleton-sd\poc-plattform-kit`
- [ ] Branch protection on `main`: require PR, **require human approval**, disallow AI/bot merge if possible
- [ ] Connect repo in [Cursor Integrations](https://cursor.com/dashboard/integrations)

## 2. ClickUp (workspace `90161394355`) — locked locations

- **Tickets list (only):** https://app.clickup.com/90161394355/v/li/901616287298 (`901616287298`) in space PoC
- **Architecture Doc:** https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- **Decisions / Docs folder:** https://app.clickup.com/90161394355/v/f/901610744236/90165834867 (`folder_id=901610744236`)
- Do **not** create a new Platform Kit space/list
- Statuses already on the list: **TO DO**, **IN PROGRESS**, **READY FOR AI**, **READY FOR REVIEW**, **READY FOR HUMAN**, **COMPLETE**
- Ticket template includes `[repo=singleton-sd/poc-plattform-kit]`, acceptance criteria, tests
- [ ] Connect ClickUp ↔ Cursor (App Center + Cursor API key); default repo = this GitHub repo

## 3. Agent automations

- [ ] Implementer: pick tickets in **READY FOR AI**
- [ ] Reviewer: pick tickets in **READY FOR REVIEW** (must be a different AI than implementer)
- [ ] Humans only: merge PR when **READY FOR HUMAN**, then set **COMPLETE**

## 4. Azure

**Subscription:** **ssd-poc-plattform-kit** / `7b8343d7-969f-4b71-8864-b7925e7fae30`  
**Tenant:** `9a0e57d7-e58e-4e8b-814d-037cd7d9015c`  
**Resource group:** `rg-poc-plattform-kit` (region `australiaeast`; SWA Free in `eastasia`)  
**IaC:** [`infra/`](./infra/) — `powershell -File ./infra/deploy.ps1`

### Provisioned (2026-08-04)

| Kind | Name |
| --- | --- |
| SQL Server / DB | `pocpk-sql-si5fhs6dvxiha` / `pocpk` |
| App Service Plan + API | `pocpk-plan` / `pocpk-api-si5fhs6dvxiha` |
| Static Web App | `pocpk-web-si5fhs6dvxiha` |
| Service Bus | `pocpk-sb-si5fhs6dvxiha` |
| Key Vault | _(not yet — see below)_ |

Topics: `tenant.events`, `single-sign-on.events`, `subscriptions.events`, `contact.events`, `support.events`, `audit.events`, `reporting.events`. Consumers `audit` / `reporting` / `support` on publishing topics.

### Secrets: Azure Key Vault (locked)

**All secrets** use **Azure Key Vault** in this subscription/RG (SQL passwords, Service Bus connection strings, Entra client secrets, etc.).

| Surface | Rule |
| --- | --- |
| Local | Pull from KV. Do not commit secrets. `.env` is optional gitignored cache, preferably populated from KV. |
| GitHub Actions | OIDC → fetch from KV. |
| App Service / SWA | Key Vault references for app settings where possible. |

- [x] CLI identity can see the subscription
- [x] Core deploy (`infra/deploy.ps1`) succeeded — SQL, App Service, SWA, Service Bus
- [x] Local `.env` written by deploy (gitignored); `.env.example` has placeholders
- [ ] Key Vault provisioned in RG; migrate SQL/SB secrets from local `.env` into KV
- [ ] Entra app registration (SPA + API) — secrets in KV
- [ ] Tighten SQL firewall (`AllowAllDevPoC` → your IP)
- [ ] GitHub Actions OIDC → Key Vault; App Service/SWA use KV references
- [ ] Connect SWA ↔ GitHub for deploys

## 5. Skills

Curated skills are committed under `.cursor/skills/`. Refresh from local source:

```powershell
pnpm sync:skills
```

Source: `C:\00Personal\singleton-sd\ai-plattform\skills` (also on GitHub `singleton-sd/ai-plattform-skills`).
