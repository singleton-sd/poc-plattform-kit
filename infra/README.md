# Azure infrastructure (poc-plattform-kit)

Idempotent Bicep for the PoC stack. **No secrets in git.**

**Subscription:** `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30`  
**Resource group:** `rg-poc-plattform-kit` (`australiaeast`)

## Locked constraints

### Cost (cheapest that works)

| Resource | PoC SKU | Notes |
| --- | --- | --- |
| Azure SQL DB | **Basic** (5 DTU) | Do not use Hyperscale / high GP |
| App Service Plan | **F1 Free** | Use **B1** only if Nest needs more than Free allows |
| Static Web Apps | **Free** | Region often `eastasia` for Free |
| Service Bus | **Standard** | Topics required — Basic is queues-only; never Premium |
| Key Vault | **Standard** | No Premium HSM |
| App Configuration | **Free** | Non-secret config + KV references |

### Naming

**New resources (CAF):** `{org}-{app}-{resource}-{env}-{region}`

Example: `ssd-pocpk-kv-dev-ae`, `ssd-pocpk-appcs-dev-ae`

| Token | Value |
| --- | --- |
| org | `ssd` |
| app | `pocpk` |
| env | `dev` |
| region | `ae` = australiaeast; SWA Free may stay `eastasia` |

**Existing resources (legacy — do not rename):** `pocpk-{resource}-{uniqueString}` from first deploy. Renaming would recreate SQL/API/SWA/SB. Keep them; map in docs.

## Resources (live)

| Resource | Live name | CAF alias (not renamed) | SKU |
| --- | --- | --- | --- |
| Resource group | `rg-poc-plattform-kit` | — | — |
| Key Vault | `ssd-pocpk-kv-dev-ae` | (CAF) | Standard |
| App Configuration | `ssd-pocpk-appcs-dev-ae` | (CAF) | Free |
| SQL Server / DB | `pocpk-sql-si5fhs6dvxiha` / `pocpk` | `ssd-pocpk-sql-dev-ae` | Basic |
| App Service Plan / API | `pocpk-plan` / `pocpk-api-si5fhs6dvxiha` | `ssd-pocpk-plan-dev-ae` / `ssd-pocpk-api-dev-ae` | F1 Free |
| Static Web App | `pocpk-web-si5fhs6dvxiha` | `ssd-pocpk-swa-dev-ae` | Free |
| Service Bus | `pocpk-sb-si5fhs6dvxiha` | `ssd-pocpk-sb-dev-ae` | Standard |

### Key Vault secret names (values never in git)

| Secret name | Source env var |
| --- | --- |
| `sql-admin-password` | `AZURE_SQL_ADMIN_PASSWORD` |
| `database-url` | `DATABASE_URL` |
| `servicebus-connection-string` | `AZURE_SERVICEBUS_CONNECTION_STRING` |
| `swa-deployment-token` | (from `az staticwebapp secrets list`) |
| *(future)* `auth-secret` | `AUTH_SECRET` |
| *(future)* `azure-ad-client-secret` | `AZURE_AD_CLIENT_SECRET` |

Vault URI: `https://ssd-pocpk-kv-dev-ae.vault.azure.net/`

### App Configuration

Endpoint: `https://ssd-pocpk-appcs-dev-ae.azconfig.io`

| Key | Type |
| --- | --- |
| `app:api:baseUrl` | plain |
| `app:web:swaName` | plain |
| `app:azure:resourceGroup` | plain |
| `app:azure:keyVaultName` | plain |
| `secret:database-url` | Key Vault reference |
| `secret:servicebus-connection-string` | Key Vault reference |
| `secret:swa-deployment-token` | Key Vault reference |
| `secret:sql-admin-password` | Key Vault reference |

**How apps load config:** use the Azure App Configuration provider (or SDK) with **managed identity**. Resolve Key Vault references with the same (or app) identity that has **Key Vault Secrets User**. Do not embed secret values in App Config.

**How CI loads secrets:** GitHub Actions OIDC (`azure/login` + Variables `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID) → `az keyvault secret show`. Never GitHub Secrets for tokens/passwords.

### Service Bus topics

`tenant.events`, `single-sign-on.events`, `subscriptions.events`, `contact.events`, `support.events`, `audit.events`, `reporting.events`

Subscriptions `audit`, `reporting`, `support` on each publishing topic (`tenant` / `single-sign-on` / `subscriptions` / `contact`).

## Prerequisites

- Azure CLI (`az`) logged in with access to subscription `7b8343d7-969f-4b71-8864-b7925e7fae30`
- PowerShell 7+
- Providers registered: `Microsoft.KeyVault`, `Microsoft.AppConfiguration`

```powershell
az account set --subscription 7b8343d7-969f-4b71-8864-b7925e7fae30
pwsh ./infra/deploy.ps1 -WhatIf   # preview
pwsh ./infra/deploy.ps1           # create / update (idempotent)
```

`deploy.ps1` upserts SQL/SB/SWA secrets into Key Vault, seeds App Config plain keys + KV refs, and mirrors non-secret + secret cache into local `.env` (gitignored).

## Secrets & config surfaces

| Surface | How |
| --- | --- |
| Local | `az keyvault secret show` / App Config (optional `.env` cache) |
| GitHub Actions | OIDC → Azure login → Key Vault / App Config at runtime |
| App Service / SWA / ACA | App Configuration provider + `@Microsoft.KeyVault(...)` / KV refs via MI |

Do not paste secrets into ClickUp, GitHub Secrets, or git.
