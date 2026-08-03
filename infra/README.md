# Azure infrastructure (poc-plattform-kit)

Idempotent Bicep for the PoC stack. **No secrets in git.**

## Resources

| Resource | Naming pattern | Notes |
| --- | --- | --- |
| Resource group | `rg-poc-plattform-kit` | Default region `australiaeast` |
| Azure SQL Server + DB | `pocpk-sql-*` / `pocpk` | Basic SKU; admin password in local `.env` |
| App Service Plan + Web App | `pocpk-plan` / `pocpk-api-*` | Linux Node 20 |
| Static Web Apps | `pocpk-web-*` | Free SKU; location `eastasia` (Free SKU region limits) |
| Service Bus | `pocpk-sb-*` | Standard (topics) |

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

## Secrets

`deploy.ps1` writes SQL password + connection strings to repo-root `.env` (gitignored). Prefer Key Vault later; do not paste secrets into ClickUp or git.
