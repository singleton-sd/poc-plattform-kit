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
- **Custom fields** on ops list `901616287298`:

| Field | Type | UUID | Usage |
| --- | --- | --- | --- |
| **Claim Token** | text | `50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7` | Exclusive agent lock: empty = available; non-empty = claimed by that session |
| **Preview URL** | website/link | `978d43d5-e404-4262-98a2-0193ade4736d` | PR / SWA / API preview link when available |
| **Token Estimate** | number | `ab22f8d4-df04-435e-849a-9ca6c23489be` | Set when the task is planned |
| **Token Spent** | number | `be7b08e9-b094-4578-bd0a-49f20af85f3c` | Set when the task is finished |

- **Access (locked):** use REST via [`scripts/clickup.ps1`](scripts/clickup.ps1) (Windows) or [`scripts/clickup.sh`](scripts/clickup.sh) (Linux / Cursor Cloud) + env `CLICKUP_API_TOKEN`. **Do not use ClickUp MCP** for routine list/get/claim/status/comment — MCP burns a shared rate budget and can lock the workspace for ~10h. On HTTP 429, stop ClickUp calls in that chat (no retries/spin). Custom field writes must use Set Custom Field Value (`…/task/{id}/field/{field_id}`), not Update Task. Bootstrap Claim Token field: [`scripts/ensure-claim-token-field.ps1`](scripts/ensure-claim-token-field.ps1).

## ClickUp statuses

| Group | Statuses |
| --- | --- |
| Not started | `TO DO` |
| Active | `IN PROGRESS`, `READY FOR AI` |
| Done | `READY FOR REVIEW`, `READY FOR HUMAN` |
| Closed | `COMPLETE` |

## AI loop (mandatory)

Agents often share one ClickUp identity (`assignees: ["me"]`), so **assignee alone is not a lock**. Use **Claim Token** for exclusive pickup. Claim **before** deep research, planning, or coding (including Plan mode when the user asks to pick up a task).

### Exclusive claim protocol

1. Filter candidates via REST: `powershell -File scripts/clickup.ps1 list -Status "READY FOR AI"`. On Linux/Cloud: `./scripts/clickup.sh list "READY FOR AI"`. Script already drops rows with a Claim Token. Prefer oldest / unassigned.
2. Generate `claimToken` = Cursor chat/session id, or `agent-<uuid>` if unknown.
3. Claim: `powershell -File scripts/clickup.ps1 claim -TaskId <id> -ClaimToken <claimToken> -Status "IN PROGRESS"` (implementer). Linux/Cloud: `./scripts/clickup.sh claim <id> <claimToken> "IN PROGRESS"`. Prefer Claim Token only (default); add `-AssignMe` only when an owner must show. Optionally set **Token Estimate** with `field`.
4. `claim` refuses a nonempty foreign Claim Token, then re-fetches and verifies; on mismatch it throws — abort and pick another ticket.
5. Only then read description, plan, and implement (`get` returns description + custom fields).
6. On handoff: `powershell -File scripts/clickup.ps1 status -TaskId <id> -Status "READY FOR REVIEW" -ClearClaim` (Linux: `./scripts/clickup.sh status <id> "READY FOR REVIEW" --clear-claim`). Set **Token Spent** / **Preview URL** via `field` / `preview` when applicable. Prefer **Preview URL** over a ClickUp comment when the only payload is the PR link.

**Browse ≠ claim.** Listing or reading tickets for triage must not set Claim Token, assignee, or status.

**Stale claims.** If a ticket is **IN PROGRESS** with a Claim Token older than ~4h and no PR comment, steward/human may clear the token. Agents must not clear another session’s token unless the user asks.

1. **Implementer** runs the exclusive claim protocol on **READY FOR AI** → implement in a **git worktree** → open PR → run **PR hygiene (implementer)** → set **Preview URL** (PR) → clear **Claim Token** → set **READY FOR REVIEW**.
2. **Review bots** (for example Cursor Bugbot or ChatGPT Codex Connector) review the PR on GitHub. Agents do not claim **READY FOR REVIEW** tickets or review other agents' work.
3. Bot or human feedback that needs implementation returns the ticket to **READY FOR AI** for an agent to claim and address.
4. **Human only** reviews the test plan, comments, merges the PR, and sets **COMPLETE**.
5. Agents never approve or merge PRs. No self-review / self-approve (GitHub forbids it on solo identity).
6. **Claim Token + assignment = claiming work.** Never set Claim Token or assignee when merely browsing. Only claim when starting implementation work.

### PR hygiene (mandatory)

Agents do **not** get push notifications for conflicts, Bugbot/human PR comments, or CI. Poll GitHub before every handoff. Labels from `pr-hygiene.yml`: `needs-rebase`, `ci-failed`, `has-feedback` (filter with `gh pr list --label …`). Bounce agent-fixable issues to **READY FOR AI**; leave **READY FOR HUMAN** only when mergeable + required checks green + no open actionable feedback. See `docs/pr-pipelines.md`.

#### Implementer (before READY FOR REVIEW)

After push / PR open:

1. `gh pr checks --watch` (or loop-on-ci) until required checks green (or document skip-only failures).
2. `gh pr view --json mergeable,mergeStateStatus` → must be `MERGEABLE` / not `DIRTY`.
3. If dirty: follow **Shared hub files / conflict playbook** below (`git merge origin/main` then `pnpm resolve:conflicts`), push, re-check CI.
4. Handoff only with `./scripts/clickup.sh handoff <task-id> <pr-number> "READY FOR REVIEW" <claim-token>`; raw `status` transitions are forbidden for PR-backed work. This atomically gates CI registration/completion, mergeability, unresolved review threads, blocking labels, and the external-feedback quiet period before setting Preview URL and clearing the claim.
5. Own green CI before handoff; after conflict fixes or follow-up commits, re-run CI before re-handing off. Env/Entra blockers (e.g. AADSTS700213): one ClickUp blocker comment and stop — do not spin. Prefer current Node pin (24); do not default to `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION`.

#### Automated review and human validation

- Connected review bots inspect PRs after **READY FOR REVIEW**. Agents do not perform this review stage.
- Every PR body must include a human-readable **Test plan** with setup, numbered steps, expected results, the exact feature location (preview URL/page/route/endpoint/workflow), and a **Feedback focus** section.
- Bot or human findings that require code changes must return the ticket to **READY FOR AI**. The implementing agent re-fetches the PR tip and all feedback before making changes.

#### Steward / after READY FOR HUMAN

When asked to “check open PRs” (or on a scheduled prompt): for each open PR on READY FOR HUMAN tickets, re-check mergeable + checks + new comments since last handoff. On conflict / CI red / new human or Bugbot comments → ClickUp comment + clear **Claim Token** + **READY FOR AI** (or keep HUMAN and comment if informational only).

### Solo-repo merge (locked)

Branch protection must require **CI status checks** + **human merge**, but **must not** require approving reviews. Connected review bots provide comments and agents never approve. See `SETUP.md`.

## Branch naming (locked)

Implementer worktrees **must** use this pattern:

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

- Every implementer subagent **must** use its own `git worktree` (and branch named per **Branch naming** above).
- Never share a dirty `main` working tree across parallel agents.
- Remove the worktree when the run finishes.

## Shared hub files (conflict prevention)

Parallel PRs collide on shared “hub” paths. **Do not touch a hub unless the ticket requires it.**

| Hub | Touch only when | Notes |
| --- | --- | --- |
| `pnpm-lock.yaml` | Dep change via `pnpm install` | Never hand-edit; never line-merge |
| Root `package.json` / `pnpm-workspace.yaml` | Root tooling ticket | Prefer deps/scripts in `apps/*`, `packages/*`, `pillars/*` |
| Workspace `**/package.json` | That package’s ticket | Keep diffs minimal |
| `.cursor/skills/**` | Dedicated skills-sync chore PR | Do not run `pnpm sync:skills` inside feature PRs |
| `AGENTS.md`, `SETUP.md`, `docs/pr-pipelines.md`, `infra/README.md` | Docs/ops ticket | Otherwise file a ClickUp follow-up |
| `infra/main.bicep` + `infra/main.json` | Infra ticket | Always regenerate JSON: `az bicep build -f infra/main.bicep --outfile infra/main.json` and commit both |
| `apps/api/src/main.ts`, `app.module.ts` | API feature wiring | Minimal diffs (register module/provider only) |
| `.github/workflows/**` | CI/CD ticket | — |
| `.env.example` | New env keys required by ticket | Add keys only; no secrets |

High-churn hubs from recent PR history: workflows, `docs/**`, `SETUP.md`, skills, workspace `package.json`, `infra/main.*`, `AGENTS.md`, Nest entrypoints, `pnpm-lock.yaml`.

### Conflict playbook (mandatory on dirty / `needs-rebase`)

Agents must **not** reason through lockfiles or ARM JSON. Prefer **merge** over rebase (simpler ours/theirs):

```text
1. git fetch origin main
2. git merge origin/main
3. pnpm resolve:conflicts
4. Hand-fix only paths the script lists as remaining
5. If infra/main.bicep was fixed: az bicep build -f infra/main.bicep --outfile infra/main.json
   then re-run pnpm resolve:conflicts (or git add infra/main.json)
6. Commit the merge, push
7. gh pr checks --watch; confirm mergeable
```

Script: [`scripts/resolve-merge-conflicts.ps1`](scripts/resolve-merge-conflicts.ps1) (`pnpm resolve:conflicts`).

| Conflict path | Script action |
| --- | --- |
| `pnpm-lock.yaml` | Take main’s lock → `pnpm install` → stage |
| Any `package.json` | JSON-merge `dependencies` / `devDependencies` / `scripts` (both sides’ keys) |
| `infra/main.json` | After `main.bicep` is clean: `az bicep build` → stage |
| `.cursor/skills/**` | Take main (use `-SkillsSync` only on skills-sync tickets) |
| Docs hubs above | Take main (use `-ForceKeepFeatureDocs` to hand-merge) |
| `.env.example` | Union unique `KEY=` lines |

**Hand-fix leftovers** (script lists these; do not auto-take): `infra/main.bicep`, `apps/api/src/main.ts`, `app.module.ts`, `.github/workflows/**`.

Merge vs rebase checkout map (encoded in the script):

| Situation | main side | feature side |
| --- | --- | --- |
| Merging `main` into feature | `--theirs` | `--ours` |
| Rebasing feature onto `main` | `--ours` | `--theirs` |

Ops tip: merge foundation/hub PRs (CI, hooks, skills sync, SETUP) before long-lived feature PRs when possible.

## Architecture

Pillars (no cross-pillar DB joins or write HTTP): **Tenant**, **SingleSignOn**, **Subscriptions**, **Contact**, **Support**, **Audit**, **Reporting**, **Permissions** (OpenFGA — see Architecture Doc), **Notifications**.

- Messaging: Azure Service Bus (topics = events, queues = jobs)
- Mutations: same transaction → entity + **local Audit** + **Outbox** (when others must be notified)
- DB: Azure SQL + Prisma `sqlserver`
- Web: Next.js PWA SPA + Tailwind + [Singleton SD tokens](https://tokens.design.singletonsd.com/)
- Marketing: Astro SSG + Tailwind + Singleton SD tokens + Markdown + Decap (`/admin`) — see [docs/marketing-astro-decap.md](docs/marketing-astro-decap.md); SWA Free `ssd-pocpk-mkt-dev-ae`
- API: NestJS + Swagger on Azure App Service (prod/dev); **PR previews** on Azure Container Apps Consumption
- **HTTP clients:** OpenAPI from Nest → committed `packages/api-client/openapi.json` → Orval TS client (`@poc-plattform-kit/api-client`); see `docs/openapi-client.md`
- AuthN / coarse roles: Entra via **SingleSignOn** (e.g. tenant-admin, support-agent); Nest `APP_GUARD` session/JWT + `@Roles` — public allowlist in `docs/sso.md`
- AuthZ (fine-grained): **Permissions** pillar — `Check(subject, action, resource)`; **OpenFGA** (Zanzibar/ReBAC) on **Azure Container Apps Consumption**. Azure has no first-class app-data authZ for domain items. Other pillars call Permissions (sync HTTP or cache); never embed authZ rules in Contact/etc. Optional denial events → Audit.
- Outbound messaging: **Notifications** pillar — email (Forward Email API), SMS (android-sms-gateway), WhatsApp (Meta Cloud API default; adapter swappable). Consumes domain events + queue `notifications.send`; publishes `notification.sent` / `notification.failed` on `notifications.events`.
- **Secrets:** Azure Key Vault only (`ssd-pocpk-kv-dev-ae`)
- **App configuration:** Azure App Configuration (`ssd-pocpk-appcs-dev-ae`) with **Key Vault references** for secret values
- **CI/CD:** GitHub Actions **OIDC** → Azure → Key Vault / App Config (no deploy tokens or connection strings in GitHub Secrets)
- **Cost + naming (locked):** cheapest working SKUs (SQL Basic, App **B1** for custom-domain HTTPS, SWA Free ×2 app+marketing, SB Standard, KV Standard, App Config Free, ACR Basic, ACA Consumption for API previews + OpenFGA, LAW PerGB2018, App Insights workspace-based); new resources use CAF `ssd-pocpk-{resource}-dev-ae` — see `SETUP.md` / `infra/README.md`
- **Public hostnames (locked):** `plattform-kit.poc.singletonsd.com` (marketing), `app.plattform-kit.poc.singletonsd.com` (web), `api.plattform-kit.poc.singletonsd.com` (API). DNS in AWS Route53 → Azure CNAMEs.
- **Telemetry:** Application Insights + Log Analytics — see [docs/telemetry.md](docs/telemetry.md) and ClickUp Architecture Doc (Telemetry / Observability)

## Secrets + configuration (locked)

**Subscription:** `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30`

| Concern | Store |
| --- | --- |
| Secrets (passwords, connection strings, SWA deploy token, ACR admin, Entra secrets, notification provider keys) | Key Vault `ssd-pocpk-kv-dev-ae` |
| Non-secret app settings + KV references | App Configuration `ssd-pocpk-appcs-dev-ae` |

Secret **names** (not values): `sql-admin-password`, `database-url`, `servicebus-connection-string`, `swa-deployment-token`, `swa-marketing-deployment-token`, `acr-admin-username`, `acr-admin-password`, `acr-login-server`, `forwardemail-api-key`, `sms-gateway-username`, `sms-gateway-password`, `whatsapp-cloud-access-token`, `appinsights-connection-string`, `auth-secret`, `azure-ad-client-secret`, `github-decap-oauth-client-secret`, `clickup-api-token`.

- **Local:** pull from KV / App Config. Never commit secrets. `.env` only as optional gitignored cache.
- **CI (GitHub Actions):** OIDC login using repo **Variables** `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` (IDs only) → `az keyvault secret show` or App Config at job runtime. **Never** put `AZURE_STATIC_WEB_APPS_API_TOKEN`, `AZURE_CREDENTIALS`, or other secrets in GitHub Secrets.
- **Runtime (App Service / SWA / Container Apps):** App Configuration provider + Key Vault references via managed identity.
- Agents must not paste secrets into ClickUp, PRs, or git.

## PR pipelines & previews

Path-filtered GitHub Actions (see `docs/pr-pipelines.md` / `SETUP.md`):

| Change set | CI | Preview (PR) | Production (`main`) |
| --- | --- | --- | --- |
| `apps/web/**` | `ci-web.yml` | SWA PR preview (`preview-web.yml`, Free) via OIDC → KV | `deploy-web.yml` → SWA production |
| `apps/api/**`, `pillars/**` | `ci-api.yml` | Path B ACA (`preview-api.yml`) via OIDC → KV | `deploy-api.yml` → App Service B1 |
| `apps/marketing/**` | `ci-web.yml` (marketing filter) | SWA PR preview (`preview-marketing.yml`, Free) via OIDC → KV | `deploy-marketing.yml` → marketing SWA (`apps/marketing/dist`) |
| `packages/**` | **both** CI workflows | web preview if web deps change; ACA preview if api/pillars touch packages | matching deploy workflows when paths hit |

- **Path B locked:** per-PR API previews on Container Apps Consumption (`ssd-pocpk-aca-pr-<n>-ae`, scale to zero). Shared F1 overwrite and S1 slots are rejected/deprecated for per-PR need. F1 App Service remains prod/dev host.
- ACA auth: OIDC Variables only — `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` (no `AZURE_CREDENTIALS`).
- Local checks: pre-commit runs Prettier + ESLint on **staged files only** via
  `lint-staged` (never bypass with `--no-verify` for format/lint). Full-repo
  `pnpm format:check` / `pnpm lint` remain for humans/CI; also `pnpm test`,
  `pnpm build`. Manual staged check: `pnpm lint:staged`.
- Humans only merge; agents open PRs and hand ClickUp tickets to **READY FOR REVIEW**. Review bots provide PR feedback; humans validate the test plan and decide when the work is ready to merge.
- Production deploys use the same OIDC Variables + Key Vault pattern (no GitHub Secrets). API deploy needs **Website Contributor** on the App Service for the OIDC SP.

## Skills

Read curated skills under `.cursor/skills/` before coding (backend, frontend, test-generation, code-review, git-conventions, task-driven-development, etc.).

## TDD / quality

- Write failing tests first for behavior changes.
- Update Swagger with API changes, then regenerate the client (`pnpm openapi:export && pnpm openapi:generate`).
- Forward-only Prisma migrations.
- UI: token CSS vars + Tailwind only — no hardcoded palette hex.

## Preview scenario delivery standard

Ephemeral API PR previews run against an isolated, disposable **SQLite** database seeded from named **preview scenarios** — see [`docs/preview-scenarios.md`](docs/preview-scenarios.md) for the full framework (registry, catalog, naming convention, CLI). This is the delivery requirement layered on top of it.

**A PR touching `apps/api/**`, `pillars/**`, or `packages/db/**` must declare its preview scenarios in the PR body:**

```html
<!-- preview-scenarios: pillar/tenant/settings, feature/my-feature/happy-path -->
```

or an explicit exemption with a reason, for changes that genuinely need no preview data (docs, CI/workflow-only, infra-only, a pure refactor with no behavior change):

```html
<!-- preview-scenario: not-applicable: CI workflow tweak only, no data model or endpoint change -->
```

`.github/workflows/validate-preview-scenarios.yml` (`scripts/validate-preview-scenarios.mjs`) enforces this: it fails a PR that touches those paths with neither block present, rejects unknown scenario names with the full supported list, and proves every declared scenario actually seeds + verifies against a real throwaway SQLite database — not just that the declaration parses. `.github/pull_request_template.md` has the fields already scaffolded.

**What each kind of ticket adds:**

- **Feature / pillar work:** add or extend a `pillar/<pillar>/<scenario>` (or `feature/<slug>/<scenario>`) scenario covering the meaningful states needed for acceptance — representative happy path plus applicable empty, permission/tenant-boundary, lifecycle, and error states. See `pillar/tenant/*` in `packages/db/scripts/scenarios/fixtures/tenant.mjs` for the pattern (multiple composable scenarios sharing a base via `dependsOn`, each with its own `verify()`).
- **A reproducible, data-dependent bug fix:** add a minimal `bug/<clickup-task-id>/<scenario>` scenario that reproduces the pre-fix state, and keep it in the catalog after the fix lands as a regression fixture (its `verify()` should assert the corrected behavior). A preview scenario **complements** automated tests — it never replaces a regression/integration/contract/unit test.
- **SQL Server-specific changes** (native types, raw SQL, provider-specific migrations): still require SQL Server integration validation. Document in the PR what the SQLite preview cannot prove (see "Known SQLite vs SQL Server limitations" in the PR template).
- **Retiring a scenario:** remove it from `catalog.mjs` and its fixture module once nothing depends on it and it's no longer a meaningful regression/demo asset — don't leave dead scenarios registered "just in case."

Existing PRs/branches don't need a historical migration — the requirement applies going forward from when `validate-preview-scenarios.yml` is enabled.

## Ticket-writing guidance for data-affecting work

When writing a ClickUp ticket for `apps/api/**`, `pillars/**`, or `packages/db/**` work, include a short **Preview scenario** section in the ticket description: which scenario(s) the implementation should add/update (or "not applicable" + why), and what a reviewer should be able to observe in the deployed preview once it's done. This lets ticket → PR → preview stay traceable without inventing scenarios after the fact.

## Cursor Cloud specific instructions

pnpm workspace (`apps/*`, `packages/*`, `pillars/*`), Node 20+/pnpm 9. Root scripts (`package.json`) fan out with `pnpm -r`, so `pnpm lint`/`test`/`build` results depend on which feature PRs have merged — several `pillars/*` and `apps/web` may still be placeholder `echo` stubs on a given checkout (real coverage today is `apps/api` Jest + `packages/db` `prisma validate`). The update script's `pnpm install` picks up new deps automatically as that work lands. Note: multiple foundation PRs are in flight (tracked in ClickUp) and touch `AGENTS.md`, tooling, `apps/web`, and pillars; expect this repo to evolve and don't treat the current stub state as final.

- **API (reliably runnable):** NestJS + Swagger. `pnpm dev:api` (watch) serves on `PORT` (default 3000): health `/health`, Swagger UI `/docs`, OpenAPI JSON `/docs-json`. No DB/Prisma wiring yet, so it runs without live Azure resources.
- **Web:** `pnpm dev:web` — Next.js PWA SPA (see `apps/web`).
- **Marketing:** `pnpm dev:marketing` — Astro SSG + Tailwind + Singleton SD tokens; Markdown in `apps/marketing/src/content/`; Decap static admin at `/admin` (OAuth proxy follow-up). Build emits `apps/marketing/dist`. See `docs/marketing-astro-decap.md`.
- **Prisma needs `DATABASE_URL`:** `packages/db` scripts (`prisma validate`/`generate`, invoked by `pnpm test`/`pnpm build`) fail without it. Prisma reads `.env` from its own dir (cwd = `packages/db`), NOT the repo root, so the gitignored placeholder lives at `packages/db/.env` (created by the update script). Real value is in Azure Key Vault (`ssd-pocpk-kv-dev-ae`); the placeholder only covers schema validate/generate, not live queries.
- **If `pnpm build` fails in `packages/events`** (build runs `tsc -p tsconfig.json`): older `main` is missing `packages/events/tsconfig.json` + a `typescript` dep; a pending ClickUp-tracked PR adds them. Until it merges, build the API directly with `pnpm --filter @poc-plattform-kit/api build`.
- **`pnpm sync:skills` is Windows-only** (PowerShell); skip on Linux — skills are already committed under `.cursor/skills/`.
- **ClickUp access:** prefer [`scripts/clickup.ps1`](scripts/clickup.ps1) / [`scripts/clickup.sh`](scripts/clickup.sh) + `CLICKUP_API_TOKEN`. Raw REST also fine. Do **not** use ClickUp MCP for routine ops. On 429, stop. Per the AI-loop rules above, don't assign/move/merge tickets unless claiming or handing off.
