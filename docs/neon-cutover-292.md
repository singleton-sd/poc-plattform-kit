# Neon cutover run record (#292)

Completed 2026-09-09 against subscription `ssd-poc-plattform-kit` / RG `rg-poc-plattform-kit`.

## Cutover

1. **Neon CLI** (`pnpm exec neon connection-string`) for project `round-union-05852948` / branch `production` / database `neondb`:
   - Pooled URL → Key Vault `database-url`
   - Direct URL → Key Vault `database-url-unpooled`
2. Prior Azure SQL `database-url` value saved as **historical backup data** in Key Vault `database-url-rollback-azure-sql`. It is **not** an executable rollback path — the Azure SQL database and server were deleted in the same cutover. Recovery would require provisioning a new Postgres (or Azure SQL) target, restoring from an independent backup if one exists, updating Key Vault `database-url*`, and redeploying the API.
3. `./infra/migrate-db.sh` — schema already up to date (`20260828110000_init_postgresql`).
4. Seeded `pillar/tenant/owner` + `pillar/tenant/settings` via `packages/db/scripts/seed.mjs` against Neon (`@prisma/client`).
5. **Production API redeploy**: last App Service deploy before cutover was 2026-08-22 (pre-`postgresql` Prisma). Manual `workflow_dispatch` of **Deploy API (App Service)** on `main` after KV switch — run [34352978088](https://github.com/singleton-sd/poc-plattform-kit/actions/runs/34352978088) succeeded.

## Decommission

- Deleted Azure SQL database `pocpk` and server `pocpk-sql-si5fhs6dvxiha`.
- Soft-deleted + purged Key Vault `sql-admin-password`.
- Removed App Configuration key `secret:sql-admin-password`.
- `az sql server list` on the RG returns empty.

## Verification

- `GET /health` → 200 after redeploy.
- `GET /health/db` → 200 after redeploy (500 while App Service still ran the Aug SQL Server build against a Postgres URL).
- App Service `DATABASE_URL` remains `@Microsoft.KeyVault(.../secrets/database-url/)` (unversioned).

## Closeout (2026-09-09)

- Re-checked production: `GET /health` and `GET /health/db` → 200.
- Purged Key Vault `database-url-rollback-azure-sql` (historical backup only).
- Live database secrets remain `database-url` + `database-url-unpooled` (plus OpenFGA Neon URLs); see the [infrastructure secret inventory](../infra/README.md#key-vault-secret-names-values-never-in-git) for the complete Key Vault contents.
- Epic [#288](https://github.com/singleton-sd/poc-plattform-kit/issues/288) closed.
