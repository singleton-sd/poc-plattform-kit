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
- Local deploy helper: `scripts/deploy-swa-from-kv.ps1 -DeployName marketing`

## ClickUp

Ops list: https://app.clickup.com/90161394355/v/li/901616287298  
Architecture Doc: https://app.clickup.com/90161394355/docs/2kz0kcnk-1416  

**Note (2026-08-06):** ClickUp MCP/API was rate-limited during implement (~11h). File these tickets + paste this page into Architecture Doc when the limit clears. Leave unassigned / Claim Token empty until pickup.

### Ticket 1 — implement (Token Estimate ≈ 100000)

**Title:** Marketing: Astro + Tailwind + Singleton SD + Markdown + Decap `[repo=singleton-sd/poc-plattform-kit]`

**Status:** TO DO or READY FOR AI  

**Acceptance criteria:**

- [ ] Site uses Singleton SD token CSS vars + Tailwind only (no hardcoded palette hex)
- [ ] `pnpm --filter @poc-plattform-kit/marketing build` emits `apps/marketing/dist`
- [ ] SWA deploy uploads `dist` (not raw `public/`)
- [ ] Decap admin static files present at `/admin`
- [ ] Home + privacy + terms driven by Markdown content collections
- [ ] Repo docs mention Astro + Decap marketing stack

**Out of scope:** OAuth proxy runtime; page builder; blog/i18n.

**Branch:** `feature/<clickup-task-id>-marketing-astro-decap`

### Ticket 2 — follow-up (Token Estimate ≈ 50000, waiting_on ticket 1)

**Title:** Marketing: Decap GitHub OAuth proxy (Azure Function) `[repo=singleton-sd/poc-plattform-kit]`

**Scope:** Tiny OAuth callback; client secret in Key Vault; wire Decap `base_url` / `auth_endpoint` so non-devs can log in at `/admin`.

### Related

- [Marketing: Privacy + Terms pages](https://app.clickup.com/t/86d3yr2a8) — legal copy folded into Markdown in this work.
