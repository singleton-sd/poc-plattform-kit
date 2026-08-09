# Permissions pillar

Owns: fine-grained authZ — can subject X perform action Y on resource Z (ReBAC).

- **AuthN / coarse roles:** Entra via SingleSignOn (not this pillar).
- **Engine (PoC locked):** OpenFGA (Zanzibar-style) on Azure Container Apps Consumption.
- **API:** `Check(subject, action, resource)` — other pillars call this (sync HTTP or cache); never embed authZ rules in Contact/etc.
- **Publishes:** `permission.denied` (optional audit), relationship-change events as needed.
- **Consumes:** identity/tenant events needed to keep tuples in sync (details in stub ticket).

## Runtime behavior

The Nest module exposes:

| Route | Purpose |
| --- | --- |
| `POST /permissions/check` | OpenFGA Check (fails closed until configured) |
| `POST /permissions/grants` | Grant permanent / temporary / one-time access |
| `POST /permissions/grants/revoke` | Delete the relationship tuple (+ one-time marker) |
| `GET /permissions/health` | Pillar health |

When `OPENFGA_AUDIENCE` is set, `PermissionsService` acquires an Entra token via
managed identity (`DefaultAzureCredential`) and calls OpenFGA with
`Authorization: Bearer …` for Check and Write.

Grant types:

| Type | Behavior |
| --- | --- |
| `permanent` | Plain OpenFGA tuple write |
| `temporary` | Tuple with condition `not_yet_expired` (`expiry_time`); Check passes `current_time` — no scheduled job |
| `one_time` | Action tuple + `one_time_grant:{resource}\|{action}#pending` marker; first successful Check deletes both |

OpenFGA runs on ACA Consumption (`ssd-pocpk-openfga-dev-ae`). Model DSL:
`infra/openfga/model.fga` (re-push via `infra/deploy-openfga.ps1` after model changes).
Approver AuthZ for who may call grant/revoke is owned by the Access Request
workflow ticket — these endpoints assume a trusted internal caller for now.

## Manager/reporting-line resolution

`ManagerChainService` resolves a user's Entra reporting line (`/users/{id}/manager`
via Microsoft Graph, read-only, never writes to Entra) for Access Request approver
computation — an approver is either a tenant `admin` (OpenFGA `Check`) or someone
in the requester's manager chain. Bounded by `MANAGER_CHAIN_MAX_DEPTH` (default 5)
and cached for `MANAGER_CHAIN_CACHE_TTL_MS` (default 5 minutes) to avoid a Graph
call on every request. See the Architecture Doc "Permissions & Access Requests
(OpenFGA)" page for the full design.

**Human/infra follow-up required:** the runtime Managed Identity has no Graph
permission by default. Reading another user's `manager` via app-only auth needs
the Microsoft Graph **application permission** `User.Read.All`, granted and
admin-consented to the API's Managed Identity service principal (Entra portal
or `az rest` against `/servicePrincipals/{id}/appRoleAssignments`). Until that
grant exists, Graph returns 403 and `getManagerChain` returns `[]` for every
user (logged at `error`, not cached, so it retries on the next call rather than
suppressing resolution for the cache TTL). Tracked as ClickUp task
[86d3zetnm](https://app.clickup.com/t/86d3zetnm).
