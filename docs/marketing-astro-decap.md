# Marketing site — Astro + Decap

Locked stack for `plattform-kit.poc.singletonsd.com` (Azure SWA Free `ssd-pocpk-mkt-dev-ae`).

## Stack

| Layer | Choice |
| --- | --- |
| SSG | **Astro** (`apps/marketing`) — Markdown → static `dist/` |
| Styling | **Tailwind 3** + `@singleton-sd/tokens` (`--ssd-*` CSS; npm, not the token CDN) |
| Content | Markdown collections under `apps/marketing/src/content/pages/` |
| Non-dev editor | **Decap CMS** static UI at `/admin` (GitHub backend) |
| OAuth login | Shared org service **`cms-oauth-kit`** (`https://auth.singletonsd.com`). See [`singleton-sd/cms-oauth-kit` AGENTS.md](https://github.com/singleton-sd/cms-oauth-kit/blob/main/AGENTS.md). This repo is **not** the org Decap OAuth provider. |
| Contact email | Shared [`PostKit`](https://github.com/singleton-sd/post-kit) API via `PUBLIC_POSTKIT_API_BASE_URL` |
| Deploy site | `deploy-marketing.yml` → OIDC → Key Vault → SWA upload of `apps/marketing/dist` |

No WordPress, Gatsby, or always-on CMS server for the site itself.

### SWA routes

`public/staticwebapp.config.json` must not list trailing-slash duplicates (e.g. both `/admin` and `/admin/` rewrites) — Azure rejects the upload. Prefer a single `/admin` → `/admin/` redirect and let SWA serve `admin/index.html` for the directory. CI/deploy run `scripts/validate-staticwebapp-config.mjs` to catch duplicate routes before SWA.

## How Decap fits Astro

1. Editors open `/admin` (static SPA shipped in `public/admin/`).
2. `admin/index.html` sets `rel="cms-config-url"` to `/admin/config.yml` (needed when the URL has no trailing slash) and loads Decap at the end of `<body>` so `document.body` exists.
3. Login with GitHub via the **shared** OAuth proxy (`base_url: https://auth.singletonsd.com` in `config.yml`).
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

`astro.config.mjs` copies `@singleton-sd/tokens` CSS into `public/admin/tokens/` so the static admin SPA can `@import` it (no token CDN).

Pin the Decap version when changing overrides. Do not float `@^3.0.0`.

### Hosting

| Piece | Extra host? |
| --- | --- |
| Decap UI `/admin` | No — same SWA Free |
| Markdown content | No — GitHub |
| Astro site | No — CI build + SWA |
| GitHub OAuth login | **Yes** — shared org Function `https://auth.singletonsd.com` (`singleton-sd/cms-oauth-kit`) |
| Marketing Contact HTTP | **Yes** — shared PostKit API |

### Decap OAuth (shared)

PK consumes [`cms-oauth-kit`](https://github.com/singleton-sd/cms-oauth-kit). Do not add `/auth` or `/callback` in this repo. Shared `ORIGINS` already covers `*.singletonsd.com` (including `plattform-kit.poc.singletonsd.com`).

GitHub OAuth App: [Singleton SD CMS OAuth](https://github.com/settings/applications/3783537) (callback `https://auth.singletonsd.com/callback`). Do **not** create a Platform Kit OAuth App.

Open `/admin` only on a hostname allowed by the shared ORIGINS list. Do **not** test GitHub login on raw `*.azurestaticapps.net` default hosts.

`config.yml`:

```yaml
backend:
  name: github
  repo: singleton-sd/poc-plattform-kit
  branch: main
  base_url: https://auth.singletonsd.com
  auth_endpoint: auth
```

### Contact email (PostKit)

| Path | Role |
| --- | --- |
| `/contact` | Anonymous marketing Contact form (`POST` / `OPTIONS`) → PostKit |

Astro Contact posts to `{PUBLIC_POSTKIT_API_BASE_URL}/contact`. PostKit owns validation, rate limiting, tenant/host profiles, and email delivery.

### Human bootstrap (once)

1. Confirm shared health: `https://auth.singletonsd.com/health` returns 200. Consumer contract: [`cms-oauth-kit` AGENTS.md](https://github.com/singleton-sd/cms-oauth-kit/blob/main/AGENTS.md).
2. Confirm PostKit `/health` returns 200 and its origin allowlist includes `plattform-kit.poc.singletonsd.com`.
3. Open `https://plattform-kit.poc.singletonsd.com/admin` → Login with GitHub (custom domain only).

Editors need **write** access to `singleton-sd/poc-plattform-kit`.

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
- Shared Decap OAuth: [`singleton-sd/cms-oauth-kit`](https://github.com/singleton-sd/cms-oauth-kit)
- Shared Contact email: [`singleton-sd/post-kit`](https://github.com/singleton-sd/post-kit)
- Deploy site: `.github/workflows/deploy-marketing.yml`
- Local marketing: `pnpm dev:marketing`

## ClickUp

Ops via **REST** (`CLICKUP_API_TOKEN` env) — not MCP for routine ops.

| Item | Link |
| --- | --- |
| Ops list | https://app.clickup.com/90161394355/v/li/901616287298 |
| Astro + Decap site | https://app.clickup.com/t/86d3z0mfz |
| Architecture Doc page | https://app.clickup.com/90161394355/docs/2kz0kcnk-1416/2kz0kcnk-2876 |
| Site PR | https://github.com/singleton-sd/poc-plattform-kit/pull/61 |

Related: [Marketing: Privacy + Terms pages](https://app.clickup.com/t/86d3yr2a8) — legal copy folded into Markdown.
