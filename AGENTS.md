# AGENTS.md — poc-plattform-kit

## Repo

- GitHub: `singleton-sd/poc-plattform-kit` (`git@github.com:singleton-sd/poc-plattform-kit.git`)
- Local: `C:\00Personal\singleton-sd\poc-plattform-kit`
- ClickUp tickets must include `[repo=singleton-sd/poc-plattform-kit]`

## ClickUp (locked)

- **Tickets / ops list only:** https://app.clickup.com/90161394355/v/li/901616287298 (`list_id=901616287298`, workspace `90161394355`, space PoC)
- **Architecture Doc:** https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- **Docs folder:** https://app.clickup.com/90161394355/v/f/901610744236/90165834867 (`folder_id=901610744236`)
- Do **not** create a separate Platform Kit space/list.

## ClickUp statuses

| Group | Statuses |
| --- | --- |
| Not started | `TO DO` |
| Active | `IN PROGRESS`, `READY FOR AI` |
| Done | `READY FOR REVIEW`, `READY FOR HUMAN` |
| Closed | `COMPLETE` |

## AI loop (mandatory)

1. **Implementer** picks tickets in **READY FOR AI** → **assigns itself** to the task (ClickUp MCP `assignees: ["me"]` / resolve current identity) → set **IN PROGRESS** → implement in a **git worktree** → open PR → comment PR URL on ticket → set **READY FOR REVIEW**. Do not leave assignee empty when claiming.
2. **Reviewer** (different AI) picks **READY FOR REVIEW** → **assigns itself** as assignee for the review phase (prefer set assignee to the reviewer; if the implementer must stay visible, comment their identity on the ticket before/when reassigning) → review PR in a **worktree** → post review **comments** → set **READY FOR HUMAN**.
3. **Human only** merges the PR and sets **COMPLETE**.
4. Agents never approve or merge PRs. No self-review / self-approve (GitHub forbids it on solo identity).
5. **Assignment = claiming work.** Never assign when merely browsing or reading tickets. Only assign when starting implement or review work.

### Solo-repo merge (locked)

Branch protection must require **CI status checks** + **human merge**, but **must not** require approving reviews. When the AI reviewer shares the PR author’s GitHub identity, reviews are **comments only** (never “Approve”). See `SETUP.md`.

## Branch naming (locked)

Implementer and reviewer worktrees **must** use this pattern:

```
feature/<clickup-task-id>-<kebab-title>
```

Example: `feature/86dxxxx-prisma-azure-sql`

- Use the ClickUp task id (custom id or short id) plus a short kebab-case slug from the ticket title.
- Fallback if the id is unavailable: `feature/<short-ticket-title-slug>` (still kebab-case).
- Also allowed: `hotfix/<clickup-task-id>-<kebab-title>`, protected bases `main` / `develop`.
- Do **not** create bare names like `feature/ticket-title` without the id when the ClickUp id is known.
- GitHub branch protection / rulesets (optional enforcement) are documented in `SETUP.md`.

## Worktrees

- Every implementer/reviewer subagent **must** use its own `git worktree` (and branch named per **Branch naming** above).
- Never share a dirty `main` working tree across parallel agents.
- Remove the worktree when the run finishes.

## Architecture

Pillars (no cross-pillar DB joins or write HTTP): **Tenant**, **SingleSignOn**, **Subscriptions**, **Contact**, **Support**, **Audit**, **Reporting**, **Permissions** (OpenFGA — see Architecture Doc).

- Messaging: Azure Service Bus (topics = events, queues = jobs)
- Mutations: same transaction → entity + **local Audit** + **Outbox** (when others must be notified)
- DB: Azure SQL + Prisma `sqlserver`
- Web: Next.js PWA SPA + Tailwind + [Singleton SD tokens](https://tokens.design.singletonsd.com/)
- API: NestJS + Swagger on Azure App Service (prod/dev); **PR previews** on Azure Container Apps Consumption
- AuthN / coarse roles: Entra via **SingleSignOn** (e.g. tenant-admin, support-agent)
- AuthZ (fine-grained): **Permissions** pillar — `Check(subject, action, resource)`; **OpenFGA** (Zanzibar/ReBAC) on **Azure Container Apps Consumption**. Azure has no first-class app-data authZ for domain items. Other pillars call Permissions (sync HTTP or cache); never embed authZ rules in Contact/etc. Optional denial events → Audit.
- **Secrets:** Azure Key Vault only (`ssd-pocpk-kv-dev-ae`)
- **App configuration:** Azure App Configuration (`ssd-pocpk-appcs-dev-ae`) with **Key Vault references** for secret values
- **CI/CD:** GitHub Actions **OIDC** → Azure → Key Vault / App Config (no deploy tokens or connection strings in GitHub Secrets)
- **Cost + naming (locked):** cheapest working SKUs (SQL Basic, App F1/Free, SWA Free, SB Standard, KV Standard, App Config Free, ACR Basic, ACA Consumption for API previews + OpenFGA); new resources use CAF `ssd-pocpk-{resource}-dev-ae` — see `SETUP.md` / `infra/README.md`

## Secrets + configuration (locked)

**Subscription:** `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30`

| Concern | Store |
| --- | --- |
| Secrets (passwords, connection strings, SWA deploy token, ACR admin, Entra secrets) | Key Vault `ssd-pocpk-kv-dev-ae` |
| Non-secret app settings + KV references | App Configuration `ssd-pocpk-appcs-dev-ae` |

Secret **names** (not values): `sql-admin-password`, `database-url`, `servicebus-connection-string`, `swa-deployment-token`, `acr-admin-username`, `acr-admin-password`, `acr-login-server`.

- **Local:** pull from KV / App Config. Never commit secrets. `.env` only as optional gitignored cache.
- **CI (GitHub Actions):** OIDC login using repo **Variables** `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` (IDs only) → `az keyvault secret show` or App Config at job runtime. **Never** put `AZURE_STATIC_WEB_APPS_API_TOKEN`, `AZURE_CREDENTIALS`, or other secrets in GitHub Secrets.
- **Runtime (App Service / SWA / Container Apps):** App Configuration provider + Key Vault references via managed identity.
- Agents must not paste secrets into ClickUp, PRs, or git.

## PR pipelines & previews

Path-filtered GitHub Actions (see `docs/pr-pipelines.md` / `SETUP.md`):

| Change set | CI | Preview |
| --- | --- | --- |
| `apps/web/**` | `ci-web.yml` | SWA PR preview (`preview-web.yml`, Free) via OIDC → KV |
| `apps/api/**`, `pillars/**` | `ci-api.yml` | Path B ACA (`preview-api.yml`) via OIDC → KV |
| `packages/**` | **both** CI workflows | web preview if web deps change; ACA preview if api/pillars touch packages |

- **Path B locked:** per-PR API previews on Container Apps Consumption (`ssd-pocpk-aca-pr-<n>-ae`, scale to zero). Shared F1 overwrite and S1 slots are rejected/deprecated for per-PR need. F1 App Service remains prod/dev host.
- ACA auth: OIDC Variables only — `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` (no `AZURE_CREDENTIALS`).
- Local checks: `pnpm format:check`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Humans only merge; agents open PRs and set ClickUp to **READY FOR REVIEW** / **READY FOR HUMAN**.

## Skills

Read curated skills under `.cursor/skills/` before coding (backend, frontend, test-generation, code-review, git-conventions, task-driven-development, etc.).

## TDD / quality

- Write failing tests first for behavior changes.
- Update Swagger with API changes.
- Forward-only Prisma migrations.
- UI: token CSS vars + Tailwind only — no hardcoded palette hex.

## Cursor Cloud specific instructions

pnpm workspace (`apps/*`, `packages/*`, `pillars/*`), Node 20+/pnpm 9. Root scripts (`package.json`) fan out with `pnpm -r`, so `pnpm lint`/`test`/`build` results depend on which feature PRs have merged — several `pillars/*` and `apps/web` may still be placeholder `echo` stubs on a given checkout (real coverage today is `apps/api` Jest + `packages/db` `prisma validate`). The update script's `pnpm install` picks up new deps automatically as that work lands. Note: multiple foundation PRs are in flight (tracked in ClickUp) and touch `AGENTS.md`, tooling, `apps/web`, and pillars; expect this repo to evolve and don't treat the current stub state as final.

- **API (reliably runnable):** NestJS + Swagger. `pnpm dev:api` (watch) serves on `PORT` (default 3000): health `/health`, Swagger UI `/docs`, OpenAPI JSON `/docs-json`. No DB/Prisma wiring yet, so it runs without live Azure resources.
- **Web:** `pnpm dev:web` becomes a Next.js PWA once the web-foundation PR lands; until then it just prints a stub message.
- **Prisma needs `DATABASE_URL`:** `packages/db` scripts (`prisma validate`/`generate`, invoked by `pnpm test`/`pnpm build`) fail without it. Prisma reads `.env` from its own dir (cwd = `packages/db`), NOT the repo root, so the gitignored placeholder lives at `packages/db/.env` (created by the update script). Real value is in Azure Key Vault (`ssd-pocpk-kv-dev-ae`); the placeholder only covers schema validate/generate, not live queries.
- **If `pnpm build` fails in `packages/events`** (build runs `tsc -p tsconfig.json`): older `main` is missing `packages/events/tsconfig.json` + a `typescript` dep; a pending ClickUp-tracked PR adds them. Until it merges, build the API directly with `pnpm --filter @poc-plattform-kit/api build`.
- **`pnpm sync:skills` is Windows-only** (PowerShell); skip on Linux — skills are already committed under `.cursor/skills/`.
- **ClickUp access (cloud):** no ClickUp MCP is wired up here; use the REST API v2 with the `CLICKUP_API_TOKEN` secret, e.g. `curl -H "Authorization: $CLICKUP_API_TOKEN" https://api.clickup.com/api/v2/list/901616287298/task` (workspace `90161394355`, ops/tickets list `901616287298`, docs folder `901610744236`). `api.clickup.com` is reachable from the VM. Per the AI-loop rules above, don't assign/move/merge tickets unless explicitly asked.
