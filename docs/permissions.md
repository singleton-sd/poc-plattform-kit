# Permissions catalog (OpenFGA)

Fine-grained AuthZ lives in the **Permissions** pillar (`Check(subject, action, resource)` → OpenFGA). Coarse Entra roles (`@Roles`) stay in SingleSignOn. Do not embed AuthZ rules inside other pillars.

## Catalog sources

| Artifact | Role |
| --- | --- |
| [`infra/openfga/model.fga`](../infra/openfga/model.fga) (+ `model.json`) | Authorization model (types / relations / conditions) |
| [`infra/openfga/permissions.manifest.json`](../infra/openfga/permissions.manifest.json) | Catalog source of truth (CI / register) |
| [`apps/api/src/permissions/permissions.manifest.json`](../apps/api/src/permissions/permissions.manifest.json) | Nest/ACA runtime copy (must stay identical; bundled into `dist`) |
| [`apps/api/src/permissions/route-permissions.ts`](../apps/api/src/permissions/route-permissions.ts) | Loads the manifest and resolves Nest `method` + `route.path` (+ param id) |

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
   powershell -File ./infra/deploy-openfga.ps1
   ```

5. Confirm CI: `ci-api.yml` runs `pnpm permissions:check` on API/pillar/catalog path changes.

## Checklist

- [ ] Manifest entry exists for the guarded `METHOD` + Nest `route.path`
- [ ] `action` is defined on `resourceType` in `model.fga`
- [ ] `pnpm permissions:check` is green
- [ ] OpenFGA store has the new authorization model id (redeploy / bootstrap)
- [ ] No private `mapPermission` hardcoding in `PermissionsGuard`

## Related

- Deploy / OIDC: [`infra/README.md`](../infra/README.md) § Permissions / OpenFGA
- Pillar API: [`pillars/permissions/README.md`](../pillars/permissions/README.md)
- Access Request workflow: `POST/GET /permissions/access-requests*` (approver AuthZ + Grant)
- Agent skill: [`.cursor/skills/register-permissions/SKILL.md`](../.cursor/skills/register-permissions/SKILL.md)
