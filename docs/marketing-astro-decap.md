# Marketing site — Astro + Decap

`[repo=singleton-sd/poc-plattform-kit]`

Locked stack for `plattform-kit.poc.singletonsd.com` (Azure SWA Free `ssd-pocpk-mkt-dev-ae`).

## Stack

| Layer | Choice |
| --- | --- |
| SSG | **Astro** (`apps/marketing`) — Markdown → static `dist/` |
| Styling | **Tailwind 3** + [Singleton SD design tokens](https://tokens.design.singletonsd.com/) |
| Content | Markdown collections under `apps/marketing/src/content/pages/` |
| Non-dev editor | **Decap CMS** static UI at `/admin` (GitHub backend) |
| OAuth login | Azure Function on existing B1 `pocpk-plan` — `ssd-pocpk-decap-oauth-dev-ae` (`apps/marketing-oauth`) |
| Deploy site | `deploy-marketing.yml` → OIDC → Key Vault → SWA upload of `apps/marketing/dist` |
| Deploy OAuth | `deploy-decap-oauth.yml` → OIDC → Bicep + zip Function App |

No WordPress, Gatsby, or always-on CMS server for the site itself.

### SWA routes

`public/staticwebapp.config.json` must not list trailing-slash duplicates (e.g. both `/admin` and `/admin/` rewrites) — Azure rejects the upload. Prefer a single `/admin` → `/admin/` redirect and let SWA serve `admin/index.html` for the directory. CI/deploy run `scripts/validate-staticwebapp-config.mjs` to catch duplicate routes before SWA.

## How Decap fits Astro

1. Editors open `/admin` (static SPA shipped in `public/admin/`).
2. `admin/index.html` sets `rel="cms-config-url"` to `/admin/config.yml` (needed when the URL has no trailing slash) and loads Decap at the end of `<body>` so `document.body` exists.
3. Login with GitHub via the OAuth proxy (`base_url` in `config.yml`).
4. Decap reads/writes Markdown in git via the **GitHub API** (editorial workflow → PRs).
5. Merge to `main` runs Astro build; SWA serves the new HTML.
6. Decap does **not** talk to Astro at runtime.

## Admin UI customization

Decap has **no official admin chrome theme API**. Colors live in
[`decap-cms-ui-default/src/styles.js`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-ui-default/src/styles.js)
and are internal ([issue #1727](https://github.com/decaporg/decap-cms/issues/1727)).
Maintainers endorse CSS overrides ([discussion #7353](https://github.com/decaporg/decap-cms/discussions/7353));
class names can change across releases.

Supported Decap hooks we use:

| Hook | File / config |
| --- | --- |
| CDN install (pinned) | `public/admin/index.html` → `decap-cms@3.15.1` (no `^`) |
| `logo` / `show_in_header` | `public/admin/config.yml` + `brand-mark.svg` |
| `CMS.registerPreviewStyle` | `admin-preview.js` → `/admin/preview.css` |
| `CMS.registerPreviewTemplate('pages')` | `admin-preview.js` |
| Built-in widgets + hints | `config.yml` fields |

Product theme layers:

| Layer | Role |
| --- | --- |
| `admin.css` | Maintainer-endorsed CSS overrides (solid `--pk-*` surfaces, nav vs CTA, editor) |
| `admin-theme.js` | Unofficial Emotion hex remapper for `styles.js` `colorsRaw` leftovers; re-runs on `hashchange` |
| `preview.css` | Preview iframe only (official `registerPreviewStyle` target) |

Pin the Decap version when changing overrides. Do not float `@^3.0.0`.

### Hosting

| Piece | Extra host? |
| --- | --- |
| Decap UI `/admin` | No — same SWA Free |
| Markdown content | No — GitHub |
| Astro site | No — CI build + SWA |
| GitHub OAuth login | **Yes** — Function App `ssd-pocpk-decap-oauth-dev-ae` |

### OAuth proxy routes

| Path | Role |
| --- | --- |
| `/auth` | Redirect to GitHub authorize |
| `/callback` | Exchange code → HTML `postMessage` handshake for Decap |
| `/health` | Liveness |

`config.yml`:

```yaml
backend:
  name: github
  repo: singleton-sd/poc-plattform-kit
  branch: main
  base_url: https://ssd-pocpk-decap-oauth-dev-ae.azurewebsites.net
  auth_endpoint: auth
```

### Human bootstrap (once)

1. GitHub → **Settings → Developer settings → OAuth Apps → New**:
   - Homepage: `https://plattform-kit.poc.singletonsd.com`
   - Callback: `https://ssd-pocpk-decap-oauth-dev-ae.azurewebsites.net/callback`
2. Put client **secret** in Key Vault as `github-decap-oauth-client-secret` (never git / GitHub Secrets).
3. Set repo Variable `DECAP_OAUTH_CLIENT_ID` to the OAuth App client id (non-secret).
4. Deploy: merge this PR (CI) or run `pwsh ./scripts/deploy-decap-oauth.ps1 -OauthClientId '<id>'`.
5. Open `https://plattform-kit.poc.singletonsd.com/admin` → Login with GitHub.

Editors need **write** access to `singleton-sd/poc-plattform-kit` (or a bot account with `repo` scope).

## Content model

Decap **Pages** collection allows creating new Markdown entries (`create: true`).
Home stays on `/` via `src/pages/index.astro`; every other slug is built by
`src/pages/[slug].astro` (e.g. `/privacy`, `/terms`, or a new `/about`).
Unknown paths hit `src/pages/404.astro` (`404.html`) via SWA
`responseOverrides` — not the homepage SPA fallback.

| File | Purpose |
| --- | --- |
| `src/content/pages/home.md` | Landing brand, headline, CTA, body |
| `src/content/pages/privacy.md` | Privacy Policy |
| `src/content/pages/terms.md` | Terms of Service |
| `src/content/pages/<slug>.md` | Any additional page editors create in `/admin` |

## Repo paths

- App: `apps/marketing`
- Admin: `apps/marketing/public/admin/`
- OAuth Function: `apps/marketing-oauth/`
- OAuth Bicep: `infra/decap-oauth.bicep`
- Deploy site: `.github/workflows/deploy-marketing.yml`
- Deploy OAuth: `.github/workflows/deploy-decap-oauth.yml`
- Local marketing: `pnpm dev:marketing`
- Local OAuth: copy `local.settings.json.example` → `local.settings.json`, then `pnpm --filter @poc-plattform-kit/marketing-oauth start` (Azure Functions Core Tools)

## ClickUp

Ops via **REST** (`CLICKUP_API_TOKEN` env) — not MCP for routine ops.

| Item | Link |
| --- | --- |
| Ops list | https://app.clickup.com/90161394355/v/li/901616287298 |
| Astro + Decap site | https://app.clickup.com/t/86d3z0mfz |
| OAuth proxy | https://app.clickup.com/t/86d3z0mg0 |
| Architecture Doc page | https://app.clickup.com/90161394355/docs/2kz0kcnk-1416/2kz0kcnk-2876 |
| Site PR | https://github.com/singleton-sd/poc-plattform-kit/pull/61 |

Related: [Marketing: Privacy + Terms pages](https://app.clickup.com/t/86d3yr2a8) — legal copy folded into Markdown.
