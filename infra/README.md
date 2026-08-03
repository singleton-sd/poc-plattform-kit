# Azure infrastructure (poc-plattform-kit)

Idempotent Bicep for the PoC stack. **No secrets in git.**

**Subscription:** `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30`  
**Resource group:** `rg-poc-plattform-kit`

## Resources

| Resource | Naming pattern | Notes |
| --- | --- | --- |
| Resource group | `rg-poc-plattform-kit` | Default region `australiaeast` |
| **Key Vault** | `pocpk-kv-*` | **Locked secrets store** — provision in RG; SQL/SB/Entra and other secrets |
| Azure SQL Server + DB | `pocpk-sql-*` / `pocpk` | Basic SKU; admin password stored in Key Vault |
| App Service Plan + Web App | `pocpk-plan` / `pocpk-api-*` | Linux Node 20; prefer KV references for app settings |
| Static Web Apps | `pocpk-web-*` | Free SKU; location `eastasia` (Free SKU region limits) |
| Service Bus | `pocpk-sb-*` | Standard (topics); connection strings in Key Vault |

### Service Bus topics

`tenant.events`, `single-sign-on.events`, `subscriptions.events`, `contact.events`, `support.events`, `audit.events`, `reporting.events`

Subscriptions `audit`, `reporting`, `support` on each publishing topic (`tenant` / `single-sign-on` / `subscriptions` / `contact`).

## Prerequisites

- Azure CLI (`az`) logged in with access to subscription `7b8343d7-969f-4b71-8864-b7925e7fae30`
- PowerShell 7+

```powershell
az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
pwsh ./infra/deploy.ps1 -WhatIf   # preview
pwsh ./infra/deploy.ps1           # create / update
```

## Secrets: Azure Key Vault (locked)

All secrets use **Azure Key Vault** in this subscription/RG:

| Surface | How |
| --- | --- |
| Local | `az keyvault secret show` (or App Config/KV refs). Optional `.env` cache only (gitignored), preferably populated from KV. |
| GitHub Actions | OIDC federated credential → Azure login → fetch from KV. No long-lived production secrets only in GitHub Secrets (except bootstrap Azure creds for OIDC if required). |
| App Service / SWA | Key Vault references for app settings where possible. |

**What belongs in KV:** SQL passwords, Service Bus connection strings, Entra client secrets, and any other credentials.

### Bicep / deploy plan (Key Vault)

`main.bicep` today provisions SQL, App Service, SWA, and Service Bus. **Add Key Vault** to the same template (name `pocpk-kv-*`):

1. Resource `Microsoft.KeyVault/vaults` in RG (RBAC authorization preferred).
2. Grant App Service managed identity (and deploy/CI principal) secrets get/list.
3. After SQL/SB create: write secrets into KV (`sql-admin-password`, `database-url`, `servicebus-connection-string`, Entra secrets, …).
4. Wire App Service / SWA app settings to `@Microsoft.KeyVault(...)` references where possible.
5. Update `deploy.ps1` to upsert KV secrets and optionally hydrate local `.env` from KV (never commit `.env`).

Full KV resource + RBAC wiring can land in a follow-up infra PR; do not block other foundation work on a complete redeploy.

Do not paste secrets into ClickUp or git.
