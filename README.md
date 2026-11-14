# poc-plattform-kit

Platform kit PoC: nine NestJS pillars + Next.js PWA SPA, PostgreSQL (Neon), Service Bus.

## Engineering source of truth

Engineering work (features, bugs, infra, tech debt) is tracked as **GitHub
Issues** in this repository, not ClickUp — see
[`docs/github-source-of-truth.md`](./docs/github-source-of-truth.md) for the
full policy. Engineering technical documentation lives under
[`docs/`](./docs/README.md) (start at
[`docs/architecture/overview.md`](./docs/architecture/overview.md)).

ClickUp remains the system of record for private business/commercial
planning only (ideas, commercial strategy, pricing, customer-private
information) — it is not part of how engineering work is defined,
sequenced, or claimed.

## Stack

| Layer | Choice |
| --- | --- |
| Web | Next.js PWA SPA, Tailwind, [design tokens](https://tokens.design.singletonsd.com/) |
| Marketing | Astro SSG + Tailwind + Singleton SD tokens + Markdown + Decap (`/admin`); see [docs/marketing-astro-decap.md](./docs/marketing-astro-decap.md) |
| API | NestJS + Swagger |
| DB | PostgreSQL + Prisma (`postgresql`) — Neon PoC; Azure Flexible Server for shared |
| Messaging | Azure Service Bus |
| AuthN | Entra + Auth.js cookies (SingleSignOn) |
| AuthZ | Permissions pillar — OpenFGA (ReBAC) on ACA Consumption |
| Notifications | Forward Email · android-sms-gateway · Meta WhatsApp Cloud API |
| Secrets / config | Azure Key Vault · Azure App Configuration (KV refs) |
| CI | GitHub Actions — split `ci-web` / `ci-api` (path filters); SWA PR previews |
| Agents | READY FOR AI → REVIEW → HUMAN → COMPLETE; worktrees; humans merge |

## Pillars

`tenant` · `single-sign-on` · `permissions` · `subscriptions` · `contact` · `support` · `audit` · `reporting` · `notifications`

## Quick start

```bash
pnpm install
pnpm sync:skills
pnpm dev:api
pnpm dev:web
pnpm dev:marketing
```

See [SETUP.md](./SETUP.md), [AGENTS.md](./AGENTS.md),
[the client-facing changelog workflow](./docs/client-changelog.md),
[docs/pr-pipelines.md](./docs/pr-pipelines.md), and
[docs/marketing-astro-decap.md](./docs/marketing-astro-decap.md).

## Releases

Releases are **tag-only**. Merging to `main` runs
[`.github/workflows/release.yml`](./.github/workflows/release.yml), which
computes the next per-package semver from the latest
`@poc-plattform-kit/<package>@<semver>` git tag plus conventional commits
since then, pushes **only those tags**, and opens a GitHub Release per tag.

- Tag format stays `@poc-plattform-kit/api@0.25.0` (and the same pattern
  for every workspace package).
- The workflow never commits or pushes to `main` (no version-bump or
  CHANGELOG commits) and uses `GITHUB_TOKEN` only — no PAT and no
  ruleset bypass. Branch rulesets apply to `main`, not to tags; do not
  add a tag ruleset that requires a pull request.
- Build and publish jobs read the version from the git tag (`APP_VERSION`
  / `NEXT_PUBLIC_APP_VERSION`). Committed `package.json` versions are
  not the release source of truth.
- Live notes live in
  [GitHub Releases](https://github.com/singleton-sd/poc-plattform-kit/releases).
  Root `CHANGELOG.md` is historical.

Preview the in-memory version computation locally:

```bash
git fetch origin --tags
pnpm release
```
