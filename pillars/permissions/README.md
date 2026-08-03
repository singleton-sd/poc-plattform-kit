# Permissions pillar

Owns: fine-grained authZ — can subject X perform action Y on resource Z (ReBAC).

- **AuthN / coarse roles:** Entra via SingleSignOn (not this pillar).
- **Engine (PoC locked):** OpenFGA (Zanzibar-style) on Azure Container Apps Consumption.
- **API:** `Check(subject, action, resource)` — other pillars call this (sync HTTP or cache); never embed authZ rules in Contact/etc.
- **Publishes:** `permission.denied` (optional audit), relationship-change events as needed.
- **Consumes:** identity/tenant events needed to keep tuples in sync (details in stub ticket).
