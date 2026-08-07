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
| Deploy | `deploy-marketing.yml` → OIDC → Key Vault → SWA upload of `apps/marketing/dist` |

No WordPress, Gatsby, or always-on CMS server for the site itself.

## How Decap fits Astro

1. Editors open `/admin` (static SPA shipped in `public/admin/`).
2. Decap reads/writes Markdown in git via the **GitHub API** (editorial workflow → PRs).
3. Merge to `main` runs Astro build; SWA serves the new HTML.
4. Decap does **not** talk to Astro at runtime.

### Hosting

| Piece | Extra host? |
| --- | --- |
| Decap UI `/admin` | No — same SWA Free |
| Markdown content | No — GitHub |
| Astro site | No — CI build + SWA |
| GitHub OAuth login | **Yes** — tiny OAuth proxy (Azure Function follow-up); client secret in Key Vault |

Until the OAuth proxy exists, edit content via git/PRs. Decap `config.yml` leaves `base_url` commented for that follow-up.

## Content model

| File | Purpose |
| --- | --- |
| `src/content/pages/home.md` | Landing brand, headline, CTA, body |
| `src/content/pages/privacy.md` | Privacy Policy |
| `src/content/pages/terms.md` | Terms of Service |

## Repo paths

- App: `apps/marketing`
- Admin: `apps/marketing/public/admin/`
- Deploy workflow: `.github/workflows/deploy-marketing.yml`
- Local preview: `pnpm dev:marketing` (no Azure PR preview for marketing SWA)
- Local deploy helper: `scripts/deploy-swa-from-kv.ps1 -DeployName marketing` (builds `dist` if missing)

## ClickUp

Ops via **REST** (`CLICKUP_API_TOKEN` env) — not MCP for routine ops.

| Item | Link |
| --- | --- |
| Ops list | https://app.clickup.com/90161394355/v/li/901616287298 |
| Implement (READY FOR REVIEW) | https://app.clickup.com/t/86d3z0mfz |
| OAuth follow-up (TO DO, waiting_on implement) | https://app.clickup.com/t/86d3z0mg0 |
| Architecture Doc page | https://app.clickup.com/90161394355/docs/2kz0kcnk-1416/2kz0kcnk-2876 |
| PR | https://github.com/singleton-sd/poc-plattform-kit/pull/61 |

Related: [Marketing: Privacy + Terms pages](https://app.clickup.com/t/86d3yr2a8) — legal copy folded into Markdown.
