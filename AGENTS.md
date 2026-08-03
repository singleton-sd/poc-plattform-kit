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

1. **Implementer** picks tickets in **READY FOR AI** → optionally set **IN PROGRESS** → implement in a **git worktree** → open PR → comment PR URL on ticket → set **READY FOR REVIEW**.
2. **Reviewer** (different AI) picks **READY FOR REVIEW** → review PR in a **worktree** → post review comments → set **READY FOR HUMAN**.
3. **Human only** approves + merges the PR and sets **COMPLETE**.
4. Agents never approve or merge PRs. No self-review.

## Worktrees

- Every implementer/reviewer subagent **must** use its own `git worktree` (and branch).
- Never share a dirty `main` working tree across parallel agents.
- Remove the worktree when the run finishes.

## Architecture

Pillars (no cross-pillar DB joins or write HTTP): **Tenant**, **SingleSignOn**, **Subscriptions**, **Contact**, **Support**, **Audit**, **Reporting**.

- Messaging: Azure Service Bus (topics = events, queues = jobs)
- Mutations: same transaction → entity + **local Audit** + **Outbox** (when others must be notified)
- DB: Azure SQL + Prisma `sqlserver`
- Web: Next.js PWA SPA + Tailwind + [Singleton SD tokens](https://tokens.design.singletonsd.com/)
- API: NestJS + Swagger on Azure App Service
- Secrets: **Azure Key Vault** (subscription `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30`) — see below

## Secrets (locked)

**All secrets** live in **Azure Key Vault** in sub `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30` (SQL passwords, Service Bus connection strings, Entra client secrets, etc.).

- **Local:** pull from KV (`az keyvault secret show` or App Config/KV refs). Never commit secrets. `.env` only as optional gitignored cache, preferably populated from KV.
- **CI (GitHub Actions):** OIDC / Azure login → Key Vault. Do not keep long-lived production secrets only in GitHub Secrets (except bootstrap Azure creds for OIDC if required).
- **Runtime (App Service / SWA):** Key Vault references for app settings where possible.
- Agents must not paste secrets into ClickUp, PRs, or git.

## Skills

Read curated skills under `.cursor/skills/` before coding (backend, frontend, test-generation, code-review, git-conventions, task-driven-development, etc.).

## TDD / quality

- Write failing tests first for behavior changes.
- Update Swagger with API changes.
- Forward-only Prisma migrations.
- UI: token CSS vars + Tailwind only — no hardcoded palette hex.
