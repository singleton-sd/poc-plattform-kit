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
2. **Reviewer** (different AI) picks **READY FOR REVIEW** → **assigns itself** as assignee for the review phase (prefer set assignee to the reviewer; if the implementer must stay visible, comment their identity on the ticket before/when reassigning) → review PR in a **worktree** → post review comments → set **READY FOR HUMAN**.
3. **Human only** approves + merges the PR and sets **COMPLETE**.
4. Agents never approve or merge PRs. No self-review.
5. **Assignment = claiming work.** Never assign when merely browsing or reading tickets. Only assign when starting implement or review work.

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

Pillars (no cross-pillar DB joins or write HTTP): **Tenant**, **SingleSignOn**, **Permissions**, **Subscriptions**, **Contact**, **Support**, **Audit**, **Reporting**.

- Messaging: Azure Service Bus (topics = events, queues = jobs)
- Mutations: same transaction → entity + **local Audit** + **Outbox** (when others must be notified)
- DB: Azure SQL + Prisma `sqlserver`
- Web: Next.js PWA SPA + Tailwind + [Singleton SD tokens](https://tokens.design.singletonsd.com/)
- API: NestJS + Swagger on Azure App Service (prod/dev); **PR previews** on Azure Container Apps Consumption
- AuthN / coarse roles: Entra via **SingleSignOn** (e.g. tenant-admin, support-agent)
- AuthZ (fine-grained): **Permissions** pillar — `Check(subject, action, resource)`; **OpenFGA** (Zanzibar/ReBAC) on **Azure Container Apps Consumption**. Azure has no first-class app-data authZ for domain items. Other pillars call Permissions (sync HTTP or cache); never embed authZ rules in Contact/etc. Optional denial events → Audit.
- Secrets: **Azure Key Vault** `ssd-pocpk-kv-dev-ae` (subscription `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30`) — see below
- **Cost + naming (locked):** cheapest working SKUs (SQL Basic, App F1/Free, SWA Free, SB Standard, KV Standard, ACR Basic, ACA Consumption for API previews + OpenFGA); new resources use CAF `ssd-pocpk-{resource}-dev-ae` — see `SETUP.md` / `infra/README.md`

## Secrets (locked)

**All secrets** live in **Azure Key Vault** `ssd-pocpk-kv-dev-ae` in sub `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30` (SQL passwords, Service Bus connection strings, ACR admin, Entra client secrets, etc.).

Secret **names** (not values): `sql-admin-password`, `database-url`, `servicebus-connection-string`, `acr-admin-username`, `acr-admin-password`, `acr-login-server`.

- **Local:** pull from KV (`az keyvault secret show` or App Config/KV refs). Never commit secrets. `.env` only as optional gitignored cache, preferably populated from KV.
- **CI (GitHub Actions):** OIDC / Azure login → Key Vault. Do not keep long-lived production secrets only in GitHub Secrets (except bootstrap Azure creds for OIDC if required).
- **Runtime (App Service / SWA / ACA):** Key Vault references for app settings where possible.
- Agents must not paste secrets into ClickUp, PRs, or git.

## PR pipelines & previews

See `docs/pr-pipelines.md` / `SETUP.md`. **Path B locked:** per-PR API previews on Container Apps Consumption (`ssd-pocpk-aca-pr-<n>-ae`, scale to zero). Shared F1 overwrite and S1 slots are rejected/deprecated for per-PR need. F1 App Service remains prod/dev host. FE SWA Free previews stay as-is when enabled.

- ACA auth: OIDC only — `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` (no `AZURE_CREDENTIALS`).
- Humans only merge; agents open PRs and set ClickUp to **READY FOR REVIEW** / **READY FOR HUMAN**.

## Skills

Read curated skills under `.cursor/skills/` before coding (backend, frontend, test-generation, code-review, git-conventions, task-driven-development, etc.).

## TDD / quality

- Write failing tests first for behavior changes.
- Update Swagger with API changes.
- Forward-only Prisma migrations.
- UI: token CSS vars + Tailwind only — no hardcoded palette hex.
