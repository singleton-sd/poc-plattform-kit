# ClickUp sources of truth

Workspace: `90161394355` (space PoC). Do not invent a new Platform Kit space/list.

Repo mirror: `AGENTS.md` § ClickUp (locked).

## Tickets

- Ops list (only): https://app.clickup.com/90161394355/v/li/901616287298
  (`list_id=901616287298`)
- Ticket descriptions must include `[repo=singleton-sd/poc-plattform-kit]`; task names stay free of repository identifiers and routing markers
- Branch / PR naming: `feature/<clickup-task-id>-<kebab-title>`
- Status flow: TO DO → IN PROGRESS / READY FOR AI → READY FOR REVIEW → READY FOR HUMAN → COMPLETE
- Humans merge; agents never merge

## Documents

- Architecture Doc: https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- Docs / decisions folder: https://app.clickup.com/90161394355/v/f/901610744236/90165834867
  (`folder_id=901610744236`)

## Hard review rules

Flag violations of locked architecture (`AGENTS.md`):

| Area | Expect |
|------|--------|
| Pillars | No cross-pillar DB joins or write HTTP. Integrate via APIs, Service Bus events, or read models. Pillars: Tenant, SingleSignOn, Subscriptions, Contact, Support, Audit, Reporting, Permissions (OpenFGA). |
| Mutations | Same transaction: entity + **local** Audit + **local** Outbox when notifying others. |
| Secrets / config | Azure Key Vault (`ssd-pocpk-kv-dev-ae`) + App Configuration (`ssd-pocpk-appcs-dev-ae`) with KV references. Never commit secrets, connection strings, or SWA/Entra tokens. CI uses OIDC + repo **Variables** (IDs only) — never put deploy tokens in GitHub Secrets. |
| UI | Token CSS vars + Tailwind only — no hardcoded palette hex. |
| API | NestJS + Swagger; update OpenAPI/Swagger when the API surface changes. |
| Migrations | Prisma only, **forward-only** (see DB nested rules). |
| Naming / cost | New Azure resources: CAF `ssd-pocpk-{resource}-dev-ae`; cheapest working SKUs. |

## Path-specific rules

- Prisma / `packages/db`: also apply [`packages/db/.cursor/BUGBOT.md`](../packages/db/.cursor/BUGBOT.md) (fuller mirror: [`docs/db-practices.md`](../docs/db-practices.md)).
- `apps/web`: also apply [`apps/web/.cursor/BUGBOT.md`](../apps/web/.cursor/BUGBOT.md).
- `apps/api`: also apply [`apps/api/.cursor/BUGBOT.md`](../apps/api/.cursor/BUGBOT.md).

## Review expectations

- Prefer acceptance criteria and Architecture Doc over inventing product requirements
- Flag PRs that contradict locked ClickUp architecture/decisions or ticket AC
- Never request secrets in comments; secrets live in Azure Key Vault only
- Agent Skills (`.cursor/skills/`, synced via `pnpm sync:skills`) are for Cursor Agent only — do not treat them as Bugbot configuration
