# Custom domains — Platform Kit PoC

DNS stays in **AWS Route53** (`singletonsd.com`). Azure only receives CNAMEs /
validation TXT and custom-domain bindings for the **product app** (SWA) and
**API** (Container Apps). The **marketing** hostname is a GitHub Pages custom
domain.

Reusable tooling:

| File | Role |
| --- | --- |
| [`infra/custom-domains.pocpk.json`](../infra/custom-domains.pocpk.json) | This product's record + binding map |
| [`infra/custom-domains.schema.json`](../infra/custom-domains.schema.json) | Shape for other products |
| [`scripts/apply-route53-dns.ps1`](../scripts/apply-route53-dns.ps1) | UPSERT Route53 from any config |
| [`scripts/bind-custom-domains.ps1`](../scripts/bind-custom-domains.ps1) | Bind SWA / App Service / Container App + managed cert |
| [`scripts/deploy-swa-from-kv.ps1`](../scripts/deploy-swa-from-kv.ps1) | Deploy a static folder to the **product app** SWA via KV token |

Agents must **not** change DNS, GitHub Pages repo settings, or Azure
resources. The infrastructure owner applies the steps below.

## Locked public URLs (this PoC)

- Marketing: https://plattform-kit.poc.singletonsd.com (GitHub Pages)
- App: https://app.plattform-kit.poc.singletonsd.com (SWA Free — unchanged)
- API: https://api.plattform-kit.poc.singletonsd.com (`/health`, `/docs`; Container Apps — unchanged)

Forward Email uses a **separate** mail hostname (`mail.plattform-kit.poc.singletonsd.com`) so MX/TXT do not collide with the marketing CNAME — see [email-forward-email.md](./email-forward-email.md) (Path B topology).

Live CNAME/TXT values live in `infra/custom-domains.pocpk.json` (source of truth
for re-apply). App Service / Container App verification TXT uses Azure
`customDomainVerificationId` (lowercased in Route53).

This repository can host **only one** GitHub Pages site. Nothing else in the
monorepo (product app, API, Storybook) uses Pages; do not enable a second
source.

## Marketing GitHub Pages cutover (manual)

Do these in order. Do **not** delete the marketing SWA until HTTPS on the
custom domain is confirmed. Do **not** point DNS at `singleton-sd.github.io`
before Pages has the custom domain configured — that window serves GitHub’s
placeholder, not the brochure.

### 1. Merge the Pages workflows

Merge the PR that adds `.github/workflows/pages.yml` and
`.github/workflows/preview-marketing.yml`. Confirm `pages.yml` ran on `main`
and pushed `apps/marketing/dist` to the `gh-pages` branch (includes `CNAME`
and `.nojekyll`).

### 2. GitHub Pages repository settings

In **Settings → Pages** for `singleton-sd/poc-plattform-kit`:

1. **Source:** Deploy from a branch
2. **Branch:** `gh-pages` / `/ (root)`
3. **Custom domain:** `plattform-kit.poc.singletonsd.com`
4. Leave **Enforce HTTPS** off until GitHub has issued the certificate
   (often several minutes to a few hours after DNS resolves)

In **Settings → Actions → General → Workflow permissions**:

1. Select **Read and write permissions**
2. Save. `pages.yml` / `preview-marketing.yml` declare `contents: write`
   explicitly; the repository default must allow the workflow `GITHUB_TOKEN`
   to push `gh-pages`

GitHub provisions TLS after the CNAME resolves. Tick **Enforce HTTPS** only
when the certificate is listed as ready.

### 3. DNS (Route 53) — infrastructure owner

In the public `singletonsd.com` (or delegated `poc.singletonsd.com`) hosted
zone, change **only** the marketing record:

| Name | Type | Value | TTL |
| --- | --- | --- | --- |
| `plattform-kit.poc.singletonsd.com` (`plattform-kit.poc`) | `CNAME` | `singleton-sd.github.io` | `300` |

Do not point the subdomain at the zone apex and do not create an alias to a
private distribution. The record contains no secret.

The product app (`app.plattform-kit.poc` → `kind-rock-0f409fe00.7.azurestaticapps.net`)
and API (`api.plattform-kit.poc` → the ACA FQDN) stay as they are.

To apply from the JSON map (marketing CNAME already updated there):

```powershell
powershell -File ./scripts/apply-route53-dns.ps1
```

Do **not** run `bind-custom-domains.ps1` for the marketing hostname — GitHub
Pages is not an Azure binding. App + API bindings are unchanged.

### 4. Verify

```sh
dig +short plattform-kit.poc.singletonsd.com CNAME
curl --fail --head https://plattform-kit.poc.singletonsd.com
```

Expected DNS: `singleton-sd.github.io.` HTTPS should succeed with a
certificate valid for `plattform-kit.poc.singletonsd.com`. Then enable
**Enforce HTTPS** in Pages settings if it is not already on.

### 5. Delete the marketing SWA last

Only after step 4:

1. Delete Azure Static Web App `ssd-pocpk-mkt-dev-ae` (Free) in
   `rg-poc-plattform-kit`. Default host was
   `purple-field-05048bf00.7.azurestaticapps.net`.
2. Optionally delete Key Vault secret `swa-marketing-deployment-token` and
   App Configuration keys `app:marketing:swaName` /
   `secret:swa-marketing-deployment-token`.
3. Leave `infra/main.bicep` marketing SWA parameters until a follow-up infra
   PR removes them — a Bicep change is not required for DNS/Pages cutover
   and must not run as part of this switch.

Do **not** delete the product app SWA (`pocpk-web-si5fhs6dvxiha`) or any
Container Apps.

## Apply (app + API only)

```powershell
powershell -File ./scripts/apply-route53-dns.ps1
# wait for DNS
powershell -File ./scripts/bind-custom-domains.ps1
```

`bind-custom-domains.ps1` still binds the **app** SWA and **API** Container
App from `bindings[]`. It no longer has a marketing SWA binding.

## Apply to another domain / product later

1. Copy `infra/custom-domains.pocpk.json` → `infra/custom-domains.<app>.json`
2. Edit `zoneDomain`, `records[]`, `bindings[]`
3. Run the same scripts with `-ConfigPath`:

```powershell
powershell -File ./scripts/apply-route53-dns.ps1 -ConfigPath ./infra/custom-domains.other.json
powershell -File ./scripts/bind-custom-domains.ps1 -ConfigPath ./infra/custom-domains.other.json
```

## Pages vs former SWA behaviour

| Former SWA behaviour | GitHub Pages equivalent |
| --- | --- |
| `/admin` → `/admin/` 301 | Pages serves `admin/index.html` for `/admin` and `/admin/` (no extra redirect file) |
| `responseOverrides` 404 → `/404.html` | Pages serves `/404.html` for unknown paths at the site root (Astro emits that file) |
| Trailing-slash duplicate routes rejected | Not applicable — no `staticwebapp.config.json` on marketing |
| Custom response headers | **Gap:** Pages cannot set SWA-style global headers. Marketing SWA did not set any beyond the 404 rewrite |
| PR preview on `*.azurestaticapps.net` | `/pr-preview/pr-<n>/` on the custom domain (**same origin** as `/admin`) |
| Preview 404 | **Gap:** Pages uses the **site-root** `/404.html` (production). A missing preview URL does not serve the PR’s `404.html` |
| Decap `/admin` on a preview host | **Gap:** this repo can host only one Pages site, so PR-built JS shares the CMS origin. Fork PRs are not published. Do not browse untrusted PR previews while signed into `/admin`. Use production `/admin` for CMS login |

Contact form behaviour is unchanged: the browser posts to PostKit
(`PUBLIC_POSTKIT_API_BASE_URL`, default
`https://ssd-postkit-api-prod-ae.azurewebsites.net`). No CRM/lead intake is
wired.
