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

**Subscription:** `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30`  
**Resource group:** `rg-poc-plattform-kit` (region `australiaeast`; SWA uses `eastasia` for Free SKU)  
**IaC:** [`infra/`](./infra/) — `pwsh ./infra/deploy.ps1`

### Secrets: Azure Key Vault (locked)

**All secrets** use **Azure Key Vault** in this subscription/RG (SQL passwords, Service Bus connection strings, Entra client secrets, etc.).

| Surface | Rule |
| --- | --- |
| Local | Pull from KV (`az keyvault secret show` or App Config/KV refs). Do not commit secrets. `.env` is optional gitignored cache, preferably populated from KV. |
| GitHub Actions | OIDC federated credential / Azure login → fetch from KV. Do not store long-lived production secrets only in GitHub Secrets (except bootstrap Azure creds for OIDC if required). |
| App Service / SWA | Key Vault references for app settings where possible. |

Foundation: provision Key Vault in the RG as part of infra (see `infra/README.md`).

Planned / provisioned names (prefix `pocpk`, suffix from RG unique string):

| Kind | Name pattern |
| --- | --- |
| Key Vault | `pocpk-kv-*` |
| SQL Server + DB | `pocpk-sql-*` / `pocpk` |
| App Service Plan + API | `pocpk-plan` / `pocpk-api-*` |
| Static Web App | `pocpk-web-*` |
| Service Bus | `pocpk-sb-*` |

Topics: `tenant.events`, `single-sign-on.events`, `subscriptions.events`, `contact.events` (+ support/audit/reporting). Consumers `audit` / `reporting` / `support` on publishing topics.

- [ ] CLI identity can see the subscription (`az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30`)
- [ ] Key Vault provisioned in RG; deploy script / agents store & read secrets from KV
- [ ] `pwsh ./infra/deploy.ps1` succeeded
- [ ] Optional local `.env` from KV only (not committed); `.env.example` has placeholders
- [ ] Entra app registration (SPA + API) — secrets in KV; `AZURE_AD_*` locally from KV
- [ ] Tighten SQL firewall (`AllowAllDevPoC` → your IP)
- [ ] GitHub Actions OIDC → Key Vault; App Service/SWA use KV references
- [ ] Connect SWA ↔ GitHub for deploys

## 5. Skills

Curated skills are committed under `.cursor/skills/`. Refresh from local source:

```powershell
pnpm sync:skills
```

Source: `C:\00Personal\singleton-sd\ai-plattform\skills` (also on GitHub `singleton-sd/ai-plattform-skills`).
