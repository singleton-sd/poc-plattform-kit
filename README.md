# poc-plattform-kit

Platform kit PoC: eight NestJS pillars + Next.js PWA SPA, Azure SQL, Service Bus, ClickUp ΓåÆ Cursor agents.

## ClickUp (locked)

- **Tickets:** https://app.clickup.com/90161394355/v/li/901616287298
- **Architecture Doc:** https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- **Docs folder:** https://app.clickup.com/90161394355/v/f/901610744236/90165834867

## Stack

| Layer | Choice |
| --- | --- |
| Web | Next.js PWA SPA, Tailwind, [design tokens](https://tokens.design.singletonsd.com/) |
| API | NestJS + Swagger |
| DB | Azure SQL + Prisma (`sqlserver`) |
| Messaging | Azure Service Bus |
| AuthN | Entra + Auth.js cookies (SingleSignOn) |
| AuthZ | Permissions pillar ΓÇö OpenFGA (ReBAC) on ACA Consumption |
| CI | GitHub Actions - split `ci-web` / `ci-api` (path filters); SWA PR previews |
| Agents | READY FOR AI ΓåÆ REVIEW ΓåÆ HUMAN ΓåÆ COMPLETE; worktrees; humans merge |

## Pillars

`tenant` ┬╖ `single-sign-on` ┬╖ `permissions` ┬╖ `subscriptions` ┬╖ `contact` ┬╖ `support` ┬╖ `audit` ┬╖ `reporting`

## Quick start

```bash
pnpm install
pnpm sync:skills
pnpm dev:api
pnpm dev:web
```

See [SETUP.md](./SETUP.md), [AGENTS.md](./AGENTS.md), and [docs/pr-pipelines.md](./docs/pr-pipelines.md).
