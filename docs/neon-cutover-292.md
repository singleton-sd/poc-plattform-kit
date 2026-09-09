# Neon cutover run record (#292)

Completed 2026-09-09 against subscription `ssd-poc-plattform-kit` / RG `rg-poc-plattform-kit`.

## Cutover

1. **Neon CLI** (`pnpm exec neon connection-string`) for project `round-union-05852948` / branch `production` / database `neondb`:
   - Pooled URL → Key Vault `database-url`
   - Direct URL → Key Vault `database-url-unpooled`
2. Prior Azure SQL `database-url` value saved as Key Vault `database-url-rollback-azure-sql` (soft rollback window; purge when confident).
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

## Follow-ups

- Purge `database-url-rollback-azure-sql` after a short observation window.
- Close epic #288 once human confirms billing / App Insights look healthy.
