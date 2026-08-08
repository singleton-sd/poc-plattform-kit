# Permissions pillar

Owns: fine-grained authZ — can subject X perform action Y on resource Z (ReBAC).

- **AuthN / coarse roles:** Entra via SingleSignOn (not this pillar).
- **Engine (PoC locked):** OpenFGA (Zanzibar-style) on Azure Container Apps Consumption.
- **API:** `Check(subject, action, resource)` — other pillars call this (sync HTTP or cache); never embed authZ rules in Contact/etc.
- **Publishes:** `permission.denied` (optional audit), relationship-change events as needed.
- **Consumes:** identity/tenant events needed to keep tuples in sync (details in stub ticket).

## Stub behavior

The Nest module exposes `POST /permissions/check` and `GET /permissions/health`.
Checks fail closed (`allowed: false`) until an OpenFGA adapter is configured.
OpenFGA is hosted separately on Azure Container Apps Consumption; domain pillars
call this pillar over synchronous HTTP or a bounded cache rather than embedding
authorization rules.

## Manager/reporting-line resolution

`ManagerChainService` resolves a user's Entra reporting line (`/users/{id}/manager`
via Microsoft Graph, read-only, never writes to Entra) for Access Request approver
computation — an approver is either a tenant `admin` (OpenFGA `Check`) or someone
in the requester's manager chain. Bounded by `MANAGER_CHAIN_MAX_DEPTH` (default 5)
and cached for `MANAGER_CHAIN_CACHE_TTL_MS` (default 5 minutes) to avoid a Graph
call on every request. See the Architecture Doc "Permissions & Access Requests
(OpenFGA)" page for the full design.
