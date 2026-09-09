# Production API → Container Apps Consumption (#303)

Dual-run cutover from App Service B1 zip deploy to a persistent ACA app on the
shared preview CAE/ACR. **Do not delete App Service until the checklist below
passes.**

## Target shape

| | Production | PR previews |
| --- | --- | --- |
| Host | `ssd-pocpk-aca-api-dev-ae` | `ssd-pocpk-aca-pr-<n>-ae` |
| CAE / ACR | `ssd-pocpk-cae-dev-ae` / `ssdpocpkacrdevae` | same (shared) |
| Image | `apps/api/Dockerfile` `--target production` | `--target preview` |
| DB | Neon PostgreSQL (App Config `secret:database-url`) | SQLite template in image |
| CPU / RAM | 0.25 / 0.5Gi | 0.25 / 0.5Gi |
| Scale | min **0** / max **2** | min 0 / max 1 |
| Lifecycle | Persistent | Deleted on PR close |

Setting production `minReplicas` to `1` intentionally keeps a warm replica
(always-on compute cost). Keep `0` for PoC scale-to-zero.

## Human steps (dual-run)

1. Ensure CAE + ACR exist: `./infra/deploy-aca-preview.sh`
2. Build once locally or via Actions, then provision the prod app:
   ```bash
   # After an image exists in ACR (or let deploy-api.yml create it):
   ./infra/deploy-aca-api.sh --image ssdpocpkacrdevae.azurecr.io/pocpk-api:<sha>
   ```
3. Smoke the **ACA default hostname** (custom domain still on App Service):
   ```bash
   FQDN=$(az containerapp show -n ssd-pocpk-aca-api-dev-ae -g rg-poc-plattform-kit \
     --query properties.configuration.ingress.fqdn -o tsv)
   curl -sS "https://$FQDN/health"
   curl -sS "https://$FQDN/health/db"
   ```
4. Validate Entra login, Service Bus outbox, App Insights against the ACA URL.
5. Keep OpenFGA on App Service MI until DNS cutover:
   `./infra/deploy-openfga.sh --api-identity webapp`
6. Production deploys: tag `@poc-plattform-kit/api@*` or `workflow_dispatch` on
   **Deploy API (Container Apps)** — builds `--target production`, pushes
   `pocpk-api:<sha>`, updates the Container App, smoke-tests `/health` + `/health/db`.

## Custom domain cutover (human DNS — no automatic Route53 mutation)

1. Note the ACA FQDN from step 3.
2. Add / bind the custom hostname on the Container App (Azure Portal or
   `az containerapp hostname add` + managed certificate when available for the
   environment). Capture the validation TXT Azure shows.
3. Update Route53:
   - `api.plattform-kit.poc` CNAME → ACA FQDN (not `*.azurewebsites.net`)
   - Validation TXT as prompted
4. Update [`infra/custom-domains.pocpk.json`](../infra/custom-domains.pocpk.json)
   record value + binding `kind` to `containerapp` (cutover PR).
5. Optional repo Variable `API_PRODUCTION_BASE_URL=https://api.plattform-kit.poc.singletonsd.com`
   so `deploy-api.yml` smokes the custom host.
6. Reassign OpenFGA:
   ```bash
   ./infra/deploy-openfga.sh --api-identity containerapp
   ```
7. Confirm `https://api.plattform-kit.poc.singletonsd.com/health` and `/health/db`.
8. Only then delete live App Service + B1 plan (`pocpk-api-si5fhs6dvxiha` /
   `pocpk-plan`) and merge the IaC removal PR.

## Files

| Path | Role |
| --- | --- |
| `infra/container-apps-api-prod.bicep` | Persistent prod Container App |
| `infra/deploy-aca-api.sh` | Upsert prod app + RBAC |
| `apps/api/Dockerfile` | `--target production` \| `preview` |
| `.github/workflows/deploy-api.yml` | OIDC → ACR → ACA |
| `scripts/verify-api-containerapp.sh` | Post-deploy health |
