# Tenant pillar

Owns: tenants, tenancy boundaries, settings.

Publishes: `tenant.created`, `tenant.updated` (via local Outbox).

Consumes: —

## Tenancy context (DI)

Other pillars inject `TenancyContext` from `@poc-plattform-kit/pillar-tenant` — do **not** join Tenant tables cross-pillar.

Until SingleSignOn lands, request tenant id is resolved from the `x-tenant-id` header (middleware). SSO will augment/replace this with JWT claims.

## HTTP stub

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/tenants` | Bootstrap create (no tenant header required) |
| `GET` | `/tenants/:id` | Requires `x-tenant-id` matching `:id` |
| `PATCH` | `/tenants/:id` | Requires `x-tenant-id` matching `:id` |

Mutations write **Tenant** + **TenantAudit** + **TenantOutbox** in one transaction.
