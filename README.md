# poc-plattform-kit

Platform kit PoC: nine NestJS pillars + Next.js PWA SPA, Azure SQL, Service Bus, ClickUp → Cursor agents.

## ClickUp (locked)

- **Tickets:** https://app.clickup.com/90161394355/v/li/901616287298
- **Architecture Doc:** https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- **Docs folder:** https://app.clickup.com/90161394355/v/f/901610744236/90165834867

## Stack

| Layer | Choice |
| --- | --- |
| Web | Next.js PWA SPA, Tailwind, [design tokens](https://tokens.design.singletonsd.com/) |
| Marketing | Astro SSG + Tailwind + Singleton SD tokens + Markdown + Decap (`/admin`); see [docs/marketing-astro-decap.md](./docs/marketing-astro-decap.md) |
| API | NestJS + Swagger |
| DB | Azure SQL + Prisma (`sqlserver`) |
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

See [SETUP.md](./SETUP.md), [AGENTS.md](./AGENTS.md), [docs/pr-pipelines.md](./docs/pr-pipelines.md), and [docs/marketing-astro-decap.md](./docs/marketing-astro-decap.md).
