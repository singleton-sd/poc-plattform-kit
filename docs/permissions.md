# Permissions catalog (OpenFGA)

Fine-grained AuthZ lives in the **Permissions** pillar (`Check(subject, action, resource)` → OpenFGA). Coarse Entra roles (`@Roles`) stay in SingleSignOn. Do not embed AuthZ rules inside other pillars.

## Catalog sources

| Artifact | Role |
| --- | --- |
| [`infra/openfga/model.fga`](../infra/openfga/model.fga) (+ `model.json`) | Authorization model (types / relations / conditions) |
| [`infra/openfga/permissions.manifest.json`](../infra/openfga/permissions.manifest.json) | Catalog source of truth (CI / register) |
| [`apps/api/src/permissions/permissions.manifest.json`](../apps/api/src/permissions/permissions.manifest.json) | Nest/ACA runtime copy (must stay identical; bundled into `dist`) |
| [`apps/api/src/permissions/route-permissions.ts`](../apps/api/src/permissions/route-permissions.ts) | Loads the manifest and resolves Nest `method` + `route.path` (+ param id) |

## Tenant access administration

Tenant access uses tenant-local groups rather than Entra group claims. Entra
remains the identity and reporting-line source; the Tenant pillar owns local
groups and their direct membership, while Permissions owns the OpenFGA
relations, authorization checks, and effective-access projection. This keeps
tenant authorization independent from directory group nesting, token group
claim limits, and tenant-specific Entra configuration.

The canonical tenant roles are `owner`, `admin`, `editor`, and `viewer`.
OpenFGA models them as an additive hierarchy (`owner` includes `admin`, which
includes `editor`, which includes `viewer`). A user can receive a role either
directly or through `group:<id>#member`; effective access is the deduplicated
union of those sources. The access-administration read model exposes the
provenance of each role (`membership`, `direct`, or `group`) and an opaque
consistency version so callers do not have to infer effective access from
Tenant database rows.

Ownership and safety rules:

- Tenant owns group lifecycle and membership persistence, including its local
  Audit and Outbox records.
- Permissions owns the OpenFGA `group` principal, membership projection,
  tenant role relations, checks, and reconciliation behavior.
- Tenant remains the authorization root. API callers do not submit arbitrary
  OpenFGA subject/action/resource coordinates for access-administration
  mutations.
- Group membership changes fail closed when the OpenFGA projection cannot be
  updated. A group holding `owner` cannot have members removed or be deleted
  until that owner relation is revoked.
- Entra directory groups, nested groups, cross-tenant groups, custom tenant
  roles, and deny overrides are outside the current model. A future Entra
  group import must be one-way into the tenant-local source of truth.

Current implementation references:

| Artifact | Role |
| --- | --- |
| [`infra/openfga/model.fga`](../infra/openfga/model.fga) | `group#member` principal and tenant role hierarchy |
| [`pillars/tenant`](../pillars/tenant) | Tenant-local group and membership lifecycle |
| [`pillars/permissions`](../pillars/permissions) | OpenFGA projection and authorization behavior |
| [`apps/api/src/access-administration`](../apps/api/src/access-administration) | Effective-role read model and provenance |

## Adding a new resource / action

1. Implement the Nest route (and Prisma model if needed).
2. Register the permission (dry-run first):

   ```bash
   pnpm permissions:register -- --method PATCH --path /contacts/:id \
     --action update --resourceType contact --resourceIdParam id
   pnpm permissions:register -- --apply --method PATCH --path /contacts/:id \
     --action update --resourceType contact --resourceIdParam id
   ```

   This updates `permissions.manifest.json`, appends a `define` (or new `type`) in `model.fga`, and best-effort patches `model.json`.

3. Run the drift check:

   ```bash
   pnpm permissions:check
   ```

4. Push the model to the OpenFGA store (when infra is available):

   ```powershell
   ./infra/deploy-openfga.sh
   ```

5. Confirm CI: `ci-api.yml` runs `pnpm permissions:check` on API/pillar/catalog path changes.

## Checklist

- [ ] Manifest entry exists for the guarded `METHOD` + Nest `route.path`
- [ ] `action` is defined on `resourceType` in `model.fga`
- [ ] `pnpm permissions:check` is green
- [ ] OpenFGA store has the new authorization model id (redeploy / bootstrap)
- [ ] No private `mapPermission` hardcoding in `PermissionsGuard`

## Related

- Deploy / OIDC: the "Permissions / OpenFGA" section in [`infra/README.md`](../infra/README.md)
- Pillar API: [`pillars/permissions/README.md`](../pillars/permissions/README.md)
- Access Request workflow: `POST/GET /permissions/access-requests*` (approver AuthZ + Grant)
- Agent skill: [`.cursor/skills/register-permissions/SKILL.md`](../.cursor/skills/register-permissions/SKILL.md)
