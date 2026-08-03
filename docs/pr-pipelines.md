# PR pipelines & preview environments

`[repo=singleton-sd/poc-plattform-kit]`

## Path filters (FE / BE split)

| Workflow | Triggers when paths change | Checks |
| --- | --- | --- |
| `ci-web.yml` | `apps/web/**`, `packages/**` | prettier check, lint, build, test (web + packages) |
| `ci-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | prettier check, lint, test, build (api + pillars + packages) |
| `preview-web.yml` | `apps/web/**`, `packages/**` | SWA **PR preview** (Free) |
| `preview-api.yml` | `apps/api/**`, `pillars/**`, `packages/**` | Path A stub comment only |

**Shared packages:** changes under `packages/**` run **both** `ci-web` and `ci-api`. FE-only PRs skip API CI; API/pillar-only PRs skip web CI.

Branch naming stays `feature/<clickup-task-id>-<kebab-title>`. Humans only merge to `main`.

## Preview strategy (locked Path A)

### FE — SWA Free PR previews (yes)

Azure Static Web Apps **Free** includes PR preview environments.

- Workflow: `.github/workflows/preview-web.yml`
- Action: `Azure/static-web-apps-deploy@v1`
- App location (stub): `apps/web/public`
- Comments a reminder on the PR; the SWA action also reports the preview URL

**GitHub secret (required):** `AZURE_STATIC_WEB_APPS_API_TOKEN`

How to create it:

1. Azure Portal → Static Web App `pocpk-web-si5fhs6dvxiha` → **Manage deployment token** (copy).
2. Or CLI: `az staticwebapp secrets list --name pocpk-web-si5fhs6dvxiha --resource-group rg-poc-plattform-kit --query "properties.apiKey" -o tsv`
3. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → New repository secret named `AZURE_STATIC_WEB_APPS_API_TOKEN`.
4. Prefer also storing the same value in Key Vault (e.g. secret name `swa-deployment-token`) for later OIDC → KV; do **not** commit the token.

### BE — no slots on F1 (Path A)

True **deployment slots** need App Service **Standard (S1)+**. PoC uses **F1 Free** (`pocpk-plan` / `pocpk-api-si5fhs6dvxiha`).

| Option | Cost | Status |
| --- | --- | --- |
| **Path A (locked)** | Stay on F1 | CI build/test only; `preview-api.yml` documents strategy |
| Path A optional | Second F1 app `pocpk-api-preview` | Overwrite per PR; concurrency risk |
| **Path B** | Upgrade to **S1** + staging slot | Better DX; wire when cost allows |

Until Path B: treat API preview as **CI green + local/App Service main** unless a shared preview app is provisioned.

## Root scripts

```bash
pnpm format:check   # Prettier
pnpm format
pnpm lint           # package stubs + root ESLint
pnpm test
pnpm build
```
