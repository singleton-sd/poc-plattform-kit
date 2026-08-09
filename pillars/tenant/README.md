# Tenant pillar

Owns: tenants, tenancy boundaries, settings, per-tenant membership.

Publishes: `tenant.created`, `tenant.updated`, `tenant.member_added` (via local Outbox).

Consumes: —

## Membership

`TenantMembership` (tenantId, userId, role; unique per tenant+user) is identity/membership
only — the creator of a tenant is auto-assigned `role: "owner"` in the same transaction as
tenant creation. Fine-grained authZ stays with the **Permissions** pillar (OpenFGA); this
table doesn't enforce anything by itself, it's the foundation the invitation flow and future
per-tenant roles attach to. `TenantService.listMemberships(tenantId)` is a plain read for
that flow to consume.

## Tenancy context (DI)

Other pillars inject `TenancyContext` from `@poc-plattform-kit/pillar-tenant` — do **not** join Tenant tables cross-pillar.

Request tenant id resolution order:

1. Auth.js session / Entra JWT optional claim `tenant_id` (`AuthenticatedUser.tenantId`)
2. Legacy/dev `x-tenant-id` header when the claim is absent

`ClaimTenancyInterceptor` ensures Bearer JWT claims override a forged header after auth.

## HTTP

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/tenants` | AuthN + `@Roles('support-agent'\|'tenant-admin')` |
| `GET` | `/tenants/:id` | AuthN; tenancy context must match `:id` |
| `PATCH` | `/tenants/:id` | AuthN + `@Roles('tenant-admin')`; tenancy must match `:id` |

Mutations write **Tenant** + **TenantAudit** + **TenantOutbox** in one transaction.
