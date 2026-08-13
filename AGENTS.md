# AGENTS.md - poc-plattform-kit

## Engineering source of truth (read first)

The repository has migrated engineering delivery from ClickUp to GitHub
(tracking issue [#170](https://github.com/singleton-sd/poc-plattform-kit/issues/170)).
**[`docs/github-source-of-truth.md`](docs/github-source-of-truth.md) is the
authoritative policy** for engineering system ownership, the engineering
lifecycle, agent-ready criteria, issue dependency/parallel-execution rules,
issue/branch/worktree/PR relationships, and the public-repository safety
boundary. Read it before starting new engineering work.

**All new engineering work uses the [GitHub-native engineering
workflow](#github-native-engineering-workflow-primary) section below** — it
implements that policy operationally (claiming, branch/worktree naming,
rebase/push/PR, parallel-agent and blocked-work rules, review feedback,
completion). GitHub Issues, not ClickUp, are the primary work identifier.

The [Legacy ClickUp workflow](#legacy-clickup-workflow-existing-clickup-tracked-tickets-only)
section further down describes the pre-migration workflow. It remains the
operative mechanics **only** for existing ClickUp-tracked tickets (branches
already named `feature/<clickup-task-id>-...` / `hotfix/<clickup-task-id>-...`)
until the migration issues referenced in `docs/github-source-of-truth.md`
sections 8–9 (`#177`, `#178`) land. Do not start new work through it.

## Repo

- GitHub: `singleton-sd/poc-plattform-kit` (`git@github.com:singleton-sd/poc-plattform-kit.git`)
- Local: `C:\00Personal\singleton-sd\plattform-kit\repo` (parent workspace `plattform-kit\` also holds `worktrees\` - see Worktrees)

## GitHub-native engineering workflow (primary)

This section implements [`docs/github-source-of-truth.md`](docs/github-source-of-truth.md)
sections 3, 5, and 6 operationally. Read the policy document for the full rules;
this is the "how" for day-to-day agent execution. Nothing here reads from or
writes to ClickUp.

### Finding and claiming work

1. Work is a **GitHub Issue** in `singleton-sd/poc-plattform-kit`. The issue
   number (`#N`) is the work's identity — do not invent a parallel id.
2. An issue is **agent-ready** only when it meets every condition in
   `docs/github-source-of-truth.md` section 4 (clear goal, scope, acceptance
   criteria, stated constraints, no unresolved open questions) **and** has no
   unresolved `Depends on:` line (section 5). An issue lacking any of that is
   discovery/refinement work, not implementation work — do not start coding
   from it.
3. **Claiming is implicit and exclusive by construction:** an agent claims an
   issue simply by creating a branch/worktree for it and opening a PR against
   it. There is no separate claim-token step. Before starting, check the
   issue for an existing linked open PR (search `is:pr is:open <issue-number>
   in:body` or look for "linked pull requests" on the issue page) — if one
   exists, that work is already claimed; do not start a second, competing
   implementation. If you must abandon claimed work, close your PR (or leave
   a comment saying so) so the issue reads as unclaimed again.
4. Check `Depends on:` / `Blocks:` / `Parent:` lines on the issue (see
   `docs/github-source-of-truth.md` section 5):
   - An unresolved `Depends on: #N` (issue `#N` not yet closed) means **do
     not start** — the issue is not agent-ready yet.
   - Issues with no dependency relationship between them may be worked
     concurrently in separate worktrees/branches, provided their expected
     file sets do not substantially overlap (see **Shared hub files**
     below).
   - Never build on another agent's unmerged branch unless the issue
     explicitly declares that dependency. Always start from `origin/main`.
   - A `Parent: #N` issue is a tracking/umbrella issue, not itself a unit of
     implementation — its children are the actual work.

### Branch naming

```text
<type>/<issue-number>-<kebab-title>
```

Examples: `docs/174-github-native-orchestration-instructions`,
`feat/184-support-ticket-api`, `fix/211-login-redirect`.

`<type>` is a conventional-commit-style prefix (`feat`, `fix`, `docs`,
`chore`, `refactor`, `test`, etc.) matching the primary nature of the
change. Do not use a ClickUp id in a new branch name.

### Worktree bootstrap (required)

**Layout (locked):** open a **parent workspace** folder in your editor, not
the git clone.

```text
<parent>/                      <-- Open this folder
  repo/                        <-- git clone; stays on main
  worktrees/
    <issue-number>-<kebab-slug>/ <-- one worktree per issue
```

Example: `~/dev/singleton-sd/plattform-kit/repo` +
`~/dev/singleton-sd/plattform-kit/worktrees/174-github-native-orchestration-instructions`.

- Worktree folder name = `<issue-number>-<kebab-title>` (branch name without
  the `<type>/` prefix).
- Create every worktree from `origin/main` only, via the helper (do not
  invent sibling `*-wt-*` paths or in-repo `.worktrees/`):

```powershell
pnpm worktree:add -- -Issue 174 -Type docs -Slug github-native-orchestration-instructions
```

macOS / Linux / Docker / Cloud:

```bash
./scripts/add-worktree.sh --issue 174 --type docs --slug github-native-orchestration-instructions
```

(`add-worktree.sh` is plain bash and runs unchanged on macOS; Alpine-based
containers need `apk add bash` first since the script uses bash arrays, not
available under `sh`/`dash`.) `--task-id`/`-TaskId` and `--hotfix`/`-Hotfix`
remain as aliases for legacy ClickUp-tracked worktrees only — see
**Legacy ClickUp workflow** below.

- Then bootstrap dependencies once (the helper runs this unless
  `-SkipBootstrap`/`--skip-bootstrap`):

```bash
pnpm bootstrap:worktree
pnpm bootstrap:worktree -- -QuickCheck   # optional quick check
```

Rationale: worktrees do not share dependencies reliably on Windows;
installing per worktree prevents child-agent stalls from missing
`node_modules`. Do not use manual cross-worktree `node_modules` symlinks.

- Every implementer subagent must use its own worktree.
- Never share a dirty `main` working tree across parallel agents.
- Remove the worktree when the PR is merged or the run is abandoned:

```bash
git worktree remove ../worktrees/<issue-number>-<kebab-slug>
git worktree prune
```

### Repository workflow (fetch, rebase, push, PR)

Per `docs/github-source-of-truth.md` section 6:

1. Never work directly on `main`.
2. `git fetch origin` before starting.
3. Create the branch/worktree from `origin/main` (above).
4. Implement. Do not incorporate another agent's unmerged branch unless the
   issue explicitly declares that dependency.
5. Before pushing completed implementation:
   - `git fetch origin`
   - rebase (or merge, per the **Shared hub files / conflict playbook**
     below — that mechanical playbook is unchanged by this migration, it is
     just no longer gated on ClickUp) onto `origin/main`
   - resolve conflicts
   - run the relevant test suite
6. Push with `--force-with-lease` after a rebase. Never plain `--force`.
7. Open/update the PR with a GitHub closing keyword linking the issue:

   ```text
   Closes #174
   ```

   Use `Closes`/`Fixes`/`Resolves`, not a plain `#174` reference, so merging
   closes the issue automatically.
8. If `origin/main` changes while CI/review is running and branch
   protection or mergeability requires it, rebase again and re-push
   (`--force-with-lease`).
9. Humans merge. Agents never approve or merge their own PRs (GitHub
   forbids self-approval on a solo identity anyway).

### Review feedback

Connected review bots (e.g. Cursor Bugbot, ChatGPT Codex Connector) review
PRs on GitHub; humans may also comment. This is unchanged by the ClickUp
migration — it was already tracker-neutral:

1. After pushing, watch required CI in-session (`gh pr checks --watch`).
2. `pr-hygiene.yml` reactively labels the PR: `needs-rebase` (merge
   conflict), `ci-failed` (required lint/test/build failed), `has-feedback`
   (Bugbot/Copilot/human comment), `preview-blocked` (SWA/ACA/Chromatic
   infra — not a code bounce). Filter with `gh pr list --label <name>`.
3. Address `needs-rebase` via the conflict playbook, `ci-failed` by fixing
   and pushing, `has-feedback` by fetching issue + review comments and
   replying in-thread once resolved.
4. Once none of those three labels apply, run the handoff gate to confirm
   and mark readiness:

   ```bash
   pnpm pr:gate -- --pr <pr-number>
   ```

   This applies the `ready-for-human` label when the PR is truly mergeable,
   required CI is green, and there are no unresolved review threads (see
the "Enforced PR handoff gate" section of [`docs/pr-pipelines.md`](docs/pr-pipelines.md)
   gate). It removes the label if any blocker reappears.
5. Keep the Human Review Brief current: `node scripts/upsert-pr-review-brief.mjs --pr <n>`.
6. Bot or human feedback that requires code changes: fetch the PR tip and
   all feedback, make the change, push, and re-run the gate. There is no
   separate ticket status to move — the labels and the PR itself are the
   state.

### Completion

Merging the PR (with `Closes #N`) closes the linked issue automatically.
There is no separate "mark complete" step and no ClickUp status write — see
the "Issue closure" section of [`docs/pr-pipelines.md`](docs/pr-pipelines.md)
(GitHub-native).

## Legacy ClickUp workflow (existing ClickUp-tracked tickets only)

Everything in this section applies **only** to tickets already tracked in
ClickUp Delivery (branches named `feature/<clickup-task-id>-...` /
`hotfix/<clickup-task-id>-...`). Do not use it to start new engineering
work — use **GitHub-native engineering workflow** above. This section is
retired by [#177](https://github.com/singleton-sd/poc-plattform-kit/issues/177)
/ [#178](https://github.com/singleton-sd/poc-plattform-kit/issues/178) per
`docs/github-source-of-truth.md` section 8.

- **ClickUp ticket titles:** keep names concise, sentence case, action-first,
  and human-readable. Never append repository identifiers or routing
  metadata to the task name. This is a single-repo workspace
  (Delivery/Ideas & Discovery/Human & Operations all scope to
  `singleton-sd/poc-plattform-kit`), so tickets and their descriptions do
  not need a repository marker at all.

### ClickUp (locked)

Workspace `90161394355`, space PoC, Plattform Kit folder. Use exactly these workflow lists - do not create Web/API/Marketing/pillar-specific lists (those are task classifications: Area / Pillar / Work Type / Execution).

| List | ID | Purpose |
| --- | --- | --- |
| **Delivery** | `901616287298` | Approved implementation work; **claim / AI loop / PR handoff queue** |
| **Ideas & Discovery** | `901616397764` | Unresolved ideas, spikes, design questions |
| **Human & Operations** | `901616397767` | Standalone manual gates (portal setup, billing, human-entered secrets, etc.) |

- **Delivery (claim queue):** https://app.clickup.com/90161394355/v/li/901616287298
- **Architecture Doc:** https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- **Docs folder:** https://app.clickup.com/90161394355/v/f/901610744236/90165834867 (`folder_id=901610744236`)
- Do not create a separate Platform Kit space or extra workflow lists.
- **Custom fields** on Delivery `901616287298` (claim/handoff):

| Field | Type | UUID | Usage |
| --- | --- | --- | --- |
| **Claim Token** | text | `50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7` | Exclusive agent lock: empty = available; non-empty = claimed by that session |
| **Preview URL** | website/link | `978d43d5-e404-4262-98a2-0193ade4736d` | PR / SWA / API preview link when available |
| **Token Estimate** | number | `ab22f8d4-df04-435e-849a-9ca6c23489be` | Set when the task is planned |
| **Token Spent** | number | `be7b08e9-b094-4578-bd0a-49f20af85f3c` | Set when the task is finished |

- **Access (locked):** use REST via [`scripts/clickup.ps1`](scripts/clickup.ps1) (Windows) or [`scripts/clickup.sh`](scripts/clickup.sh) (Linux / Cursor Cloud) + env `CLICKUP_API_TOKEN`. Default `-ListId` is Delivery; pass `-ListId 901616397764` or `901616397767` when creating/listing Ideas & Discovery or Human & Operations. Do not use ClickUp MCP for routine list/get/claim/status/comment - MCP burns a shared rate budget and can lock the workspace for ~10h. On HTTP 429, stop ClickUp calls in that chat (no retries/spin). Custom field writes must use Set Custom Field Value (`.../task/{id}/field/{field_id}`), not Update Task. Bootstrap Claim Token field: [`scripts/ensure-claim-token-field.ps1`](scripts/ensure-claim-token-field.ps1).

### ClickUp statuses

**Delivery** (`901616287298`) - AI claim/handoff:

| Group | Statuses |
| --- | --- |
| Not started | `BACKLOG`, `TO DO` (prefer `BACKLOG` for new unrefined work; `TO DO` retained for compatibility) |
| Active | `IN PROGRESS`, `READY FOR AI` |
| Done | `READY FOR REVIEW`, `READY FOR HUMAN` |
| Closed | `COMPLETE` |

`READY FOR HUMAN` means AI review + PR hygiene passed and a human should merge (or give final approval). It is not a bucket for standalone manual work - put those on **Human & Operations**.

**Ideas & Discovery** / **Human & Operations** use a simpler set only: `TO DO`, `IN PROGRESS`, `COMPLETE`. Do not invent Delivery statuses on those lists.

### AI loop (mandatory)

Agents often share one ClickUp identity (`assignees: ["me"]`), so assignee alone is not a lock. Use **Claim Token** for exclusive pickup. Claim before deep research, planning, or coding (including Plan mode when the user asks to pick up a task).

#### Exclusive claim protocol

**Delivery list only.** Never claim Ideas & Discovery or Human & Operations tasks.

1. Filter candidates via REST: `powershell -File scripts/clickup.ps1 list -Status "READY FOR AI"`. On Linux/Cloud: `./scripts/clickup.sh list "READY FOR AI"`. Script already drops rows with a Claim Token. Prefer oldest / unassigned.
2. Generate `claimToken` = Cursor chat/session id, or `agent-<uuid>` if unknown.
3. Claim: `powershell -File scripts/clickup.ps1 claim -TaskId <id> -ClaimToken <claimToken> -Status "IN PROGRESS"` (implementer). Linux/Cloud: `./scripts/clickup.sh claim <id> <claimToken> "IN PROGRESS"`. Prefer Claim Token only (default); add `-AssignMe` only when an owner must show. Optionally set **Token Estimate** with `field`.
4. `claim` refuses a nonempty foreign Claim Token, then re-fetches and verifies; on mismatch it throws - abort and pick another ticket.
5. Only then read description, plan, and implement (`get` returns description + custom fields).
6. On handoff: `powershell -File scripts/clickup.ps1 status -TaskId <id> -Status "READY FOR REVIEW" -ClearClaim` (Linux: `./scripts/clickup.sh status <id> "READY FOR REVIEW" --clear-claim`). Set **Token Spent** / **Preview URL** via `field` / `preview` when applicable. Prefer **Preview URL** over a ClickUp comment when the only payload is the PR link.

**Browse != claim.** Listing or reading tickets for triage must not set Claim Token, assignee, or status.

**Stale claims.** If a ticket is **IN PROGRESS** with a Claim Token older than ~4h and no PR comment, steward/human may clear the token. Agents must not clear another session's token unless the user asks.

1. **Implementer** runs the exclusive claim protocol on **READY FOR AI** -> implement in a **git worktree** -> open PR -> run **PR hygiene (implementer)** -> set **Preview URL** (PR) -> clear **Claim Token** -> set **READY FOR REVIEW**.
2. **Review bots** (for example Cursor Bugbot or ChatGPT Codex Connector) review the PR on GitHub. Agents do not claim **READY FOR REVIEW** tickets or review other agents' work.
3. Bot or human feedback that needs implementation returns the ticket to **READY FOR AI** for an agent to claim and address.
4. **Human only** reviews the test plan, comments, merges the PR, and sets **COMPLETE**.
5. Agents never approve or merge PRs. No self-review / self-approve (GitHub forbids it on solo identity).
6. **Claim Token + assignment = claiming work.** Never set Claim Token or assignee when merely browsing. Only claim when starting implementation work.

#### PR hygiene (mandatory)

Agents do not get push notifications for conflicts, Bugbot/human PR comments, or CI. After a PR is open, watch required CI in-session (`gh pr checks --watch`) and upsert the **Human Review Brief**. Labels from `pr-hygiene.yml`: `needs-rebase`, `ci-failed`, `has-feedback`, `preview-blocked` (filter with `gh pr list --label ...`). `ci-failed` is required lint/test/build only. `preview-blocked` is SWA/ACA/Chromatic infra and does not bounce ClickUp. Hygiene workflows set labels only — they do not post status comments. Bounce agent-fixable issues to **READY FOR AI**; leave **READY FOR HUMAN** only when mergeable + required checks green + no open actionable feedback. See `docs/pr-pipelines.md`.

##### Implementer (before READY FOR REVIEW)

After push / PR open:

1. `gh pr checks --watch` (or loop-on-ci) until required lint/test/build checks green (or document skip-only failures). Preview/Chromatic red is infra — put it on the brief, do not treat it as a code defect.
2. `gh pr view --json mergeable,mergeStateStatus` -> must be `MERGEABLE` / not `DIRTY`.
3. If dirty: follow **Shared hub files / conflict playbook** below (`git merge origin/main` then `pnpm resolve:conflicts`), push, re-check CI.
4. Upsert the Human Review Brief (`node scripts/upsert-pr-review-brief.mjs --pr <n>`). Do not post hygiene/status comments.
5. Handoff only with `./scripts/clickup.sh handoff <task-id> <pr-number> "READY FOR REVIEW" <claim-token>`. Raw `status` transitions are forbidden for PR-backed work. The CLI gate requires required CI, mergeability, and no unresolved review threads, then upserts the brief and sets Preview URL.
6. Own green CI before handoff; after conflict fixes or follow-up commits, re-run CI before re-handing off. Env/Entra blockers (e.g. AADSTS700213): one ClickUp blocker comment and stop - do not spin. Prefer current Node pin (24); do not default to `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION`.

##### Automated review and human validation

- Connected review bots inspect PRs after **READY FOR REVIEW**. Agents do not perform this review stage.
- Every PR body must include a human-readable **Test plan** with setup, numbered steps, expected results, the exact feature location (preview URL/page/route/endpoint/workflow), and a **Feedback focus** section.
- Bot or human findings that require code changes must return the ticket to **READY FOR AI**. The implementing agent re-fetches the PR tip and all feedback before making changes.

##### Steward / after READY FOR HUMAN

When asked to "check open PRs" (or on a scheduled prompt): for each open PR on READY FOR HUMAN tickets, re-check mergeable + checks + new comments since last handoff. On conflict / CI red / new human or Bugbot comments -> ClickUp comment + clear **Claim Token** + **READY FOR AI** (or keep HUMAN and comment if informational only).

### Branch naming (legacy, ClickUp-tracked tickets only)

Implementer worktrees must use this pattern:

```
feature/<clickup-task-id>-<kebab-title>
```

Example: `feature/86dxxxx-prisma-azure-sql`

- Use the ClickUp task id (custom id or short id) plus a short kebab-case slug from the ticket title.
- Fallback if the id is unavailable: `feature/<short-ticket-title-slug>` (still kebab-case).
- Also allowed: `hotfix/<clickup-task-id>-<kebab-title>`, protected bases `main` / `develop`.
- Do not create bare names like `feature/ticket-title` without the id when the ClickUp id is known.
- GitHub branch protection / rulesets (optional enforcement) are documented in `SETUP.md`.

#### New worktree bootstrap (required)

In each new worktree, run bootstrap once before coding/testing:

```powershell
pnpm bootstrap:worktree
```

Optional quick check:

```powershell
pnpm bootstrap:worktree -- -QuickCheck
```

Rationale: worktrees do not share dependencies reliably on Windows; installing per worktree prevents child-agent stalls from missing node_modules. Do not use manual cross-worktree node_modules symlinks.

### Worktrees (legacy, ClickUp-tracked tickets only)

**Layout (locked):** open a **parent workspace** folder in Cursor, not the git clone.

```text
<parent>/                      <-- Open this folder
  repo/                        <-- git clone; stays on main
  worktrees/
    <clickup-id>-<kebab-slug>/ <-- one worktree per ticket
```

Windows example: `C:\00Personal\singleton-sd\plattform-kit\repo` + `...\worktrees\86d3zc5af-permission-gating`.

macOS / Docker example (same layout, any parent directory you choose):

```text
~/dev/singleton-sd/plattform-kit/repo
~/dev/singleton-sd/plattform-kit/worktrees/86d3zc5af-permission-gating
```

- Worktree folder name = branch name without `feature/` or `hotfix/`.
- Create from `origin/main` only, via the helper (do not invent sibling `*-wt-*` paths or in-repo `.worktrees/`):

```powershell
pnpm worktree:add -- -TaskId 86d3zc5af -Slug permission-gating
```

macOS / Linux / Docker / Cloud: `./scripts/add-worktree.sh --task-id 86d3zc5af --slug permission-gating`. `add-worktree.sh` is plain bash and runs unchanged on macOS; Alpine-based containers need `apk add bash` first since the script uses bash arrays (not available under `sh`/`dash`).

- Then `pnpm bootstrap:worktree` (the helper runs this unless `-SkipBootstrap`).
- Every implementer subagent must use its own worktree (branch named per **Branch naming** above).
- Never share a dirty `main` working tree across parallel agents.
- Remove the worktree when the PR is merged or the run is abandoned:

```powershell
git worktree remove ../worktrees/<clickup-id>-<kebab-slug>
git worktree prune
```

## Solo-repo merge (locked)

Branch protection must require **CI status checks** + **human merge**, but must not require approving reviews. Connected review bots provide comments and agents never approve. See `SETUP.md`.

## Shared hub files (conflict prevention)

Parallel PRs collide on shared hub paths. **Do not touch a hub unless the ticket requires it.**

| Hub | Touch only when | Notes |
| --- | --- | --- |
| `pnpm-lock.yaml` | Dep change via `pnpm install` | Never hand-edit; never line-merge |
| Root `package.json` / `pnpm-workspace.yaml` | Root tooling ticket | Prefer deps/scripts in `apps/*`, `packages/*`, `pillars/*` |
| Workspace `**/package.json` | That package's ticket | Keep diffs minimal |
| `.cursor/skills/**` | Dedicated skills-sync chore PR | Do not run `pnpm sync:skills` inside feature PRs |
| `AGENTS.md`, `SETUP.md`, `docs/pr-pipelines.md`, `infra/README.md` | Docs/ops issue | Otherwise open a GitHub issue as a follow-up |
| `infra/main.bicep` + `infra/main.json` | Infra ticket | Always regenerate JSON: `az bicep build -f infra/main.bicep --outfile infra/main.json` and commit both |
| `apps/api/src/main.ts`, `app.module.ts` | API feature wiring | Minimal diffs (register module/provider only) |
| `.github/workflows/**` | CI/CD ticket | - |
| `.env.example` | New env keys required by ticket | Add keys only; no secrets |

High-churn hubs from recent PR history: workflows, `docs/**`, `SETUP.md`, skills, workspace `package.json`, `infra/main.*`, `AGENTS.md`, Nest entrypoints, `pnpm-lock.yaml`.

### Conflict playbook (mandatory on dirty / `needs-rebase`)

Agents must not reason through lockfiles or ARM JSON. Prefer **merge** over rebase (simpler ours/theirs):

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
| `pnpm-lock.yaml` | Take main's lock -> `pnpm install` -> stage |
| Any `package.json` | JSON-merge `dependencies` / `devDependencies` / `scripts` (both sides' keys) |
| `infra/main.json` | After `main.bicep` is clean: `az bicep build` -> stage |
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

Narrative overview, multitenancy model, and settled architecture decisions: [`docs/architecture/overview.md`](docs/architecture/overview.md), [`docs/architecture/engineering-principles.md`](docs/architecture/engineering-principles.md), [`docs/adr/`](docs/adr/). The summary below is the quick-reference version of the same material.

Pillars (no cross-pillar DB joins or write HTTP): **Tenant**, **SingleSignOn**, **Subscriptions**, **Contact**, **Support**, **Audit**, **Reporting**, **Permissions** (OpenFGA - see [`docs/adr/0002-openfga-fine-grained-authorization.md`](docs/adr/0002-openfga-fine-grained-authorization.md)), **Notifications**.

- Messaging: Azure Service Bus (topics = events, queues = jobs)
- Mutations: same transaction -> entity + **local Audit** + **Outbox** (when others must be notified)
- DB: Azure SQL + Prisma `sqlserver`
- Web: Next.js PWA SPA + Tailwind + [Singleton SD tokens](https://tokens.design.singletonsd.com/)
- Marketing: Astro SSG + Tailwind + Singleton SD tokens + Markdown + Decap (`/admin`) - see [docs/marketing-astro-decap.md](docs/marketing-astro-decap.md); SWA Free `ssd-pocpk-mkt-dev-ae`
- **Marketing edge (locked):** public anonymous HTTP for the brochure site (Contact form, future marketing-only endpoints) runs on Azure Function App `ssd-pocpk-decap-oauth-dev-ae` (`apps/marketing-oauth`, B1 `pocpk-plan`) - not on Nest `apps/api`. Stable client env: `PUBLIC_MARKETING_API_BASE_URL`. See [docs/marketing-edge.md](docs/marketing-edge.md). Split to a dedicated marketing API only when this host outgrows Decap OAuth + thin edge routes.
- API: NestJS + Swagger on Azure App Service (prod/dev); **PR previews** on Azure Container Apps Consumption
- **HTTP clients:** OpenAPI from Nest -> committed `packages/api-client/openapi.json` -> Orval TS client (`@poc-plattform-kit/api-client`); see `docs/openapi-client.md`
- AuthN / coarse roles: Entra via **SingleSignOn** (e.g. tenant-admin, support-agent); Nest `APP_GUARD` session/JWT + `@Roles` - public allowlist in `docs/sso.md`
- AuthZ (fine-grained): **Permissions** pillar - `Check(subject, action, resource)`; **OpenFGA** (Zanzibar/ReBAC) on **Azure Container Apps Consumption**. Azure has no first-class app-data authZ for domain items. Other pillars call Permissions (sync HTTP or cache); never embed authZ rules in Contact/etc. Optional denial events -> Audit.
- Outbound messaging: **Notifications** pillar - email (Forward Email API), SMS (android-sms-gateway), WhatsApp (Meta Cloud API default; adapter swappable). Consumes domain events + queue `notifications.send`; publishes `notification.sent` / `notification.failed` on `notifications.events`.
- **Secrets:** Azure Key Vault only (`ssd-pocpk-kv-dev-ae`)
- **App configuration:** Azure App Configuration (`ssd-pocpk-appcs-dev-ae`) with **Key Vault references** for secret values
- **CI/CD:** GitHub Actions **OIDC** -> Azure -> Key Vault / App Config (no deploy tokens or connection strings in GitHub Secrets)
- **Cost + naming (locked):** cheapest working SKUs (SQL Basic, App **B1** for custom-domain HTTPS, SWA Free x2 app+marketing, SB Standard, KV Standard, App Config Free, ACR Basic, ACA Consumption for API previews + OpenFGA, LAW PerGB2018, App Insights workspace-based); new resources use CAF `ssd-pocpk-{resource}-dev-ae` - see `SETUP.md` / `infra/README.md`
- **Public hostnames (locked):** `plattform-kit.poc.singletonsd.com` (marketing), `app.plattform-kit.poc.singletonsd.com` (web), `api.plattform-kit.poc.singletonsd.com` (API). DNS in AWS Route53 -> Azure CNAMEs.
- **Telemetry:** Application Insights + Log Analytics - see [docs/telemetry.md](docs/telemetry.md)

## Secrets + configuration (locked)

**Subscription:** `ssd-poc-plattform-kit` / `7b8343d7-969f-4b71-8864-b7925e7fae30`

| Concern | Store |
| --- | --- |
| Secrets (passwords, connection strings, SWA deploy token, ACR admin, Entra secrets, notification provider keys) | Key Vault `ssd-pocpk-kv-dev-ae` |
| Non-secret app settings + KV references | App Configuration `ssd-pocpk-appcs-dev-ae` |

Secret **names** (not values): `sql-admin-password`, `database-url`, `servicebus-connection-string`, `swa-deployment-token`, `swa-marketing-deployment-token`, `acr-admin-username`, `acr-admin-password`, `acr-login-server`, `forwardemail-api-key`, `sms-gateway-username`, `sms-gateway-password`, `whatsapp-cloud-access-token`, `appinsights-connection-string`, `auth-secret`, `azure-ad-client-secret`, `github-decap-oauth-client-secret`, `chromatic-project-token`, `clickup-api-token`.

- **Local:** pull from KV / App Config. Never commit secrets. `.env` only as optional gitignored cache.
- **CI (GitHub Actions):** OIDC login using repo **Variables** `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` (IDs only) -> `az keyvault secret show` or App Config at job runtime. **Never** put `AZURE_STATIC_WEB_APPS_API_TOKEN`, `AZURE_CREDENTIALS`, or other secrets in GitHub Secrets.
- **Runtime (App Service / SWA / Container Apps):** App Configuration provider + Key Vault references via managed identity.
- Agents must not paste secrets into ClickUp, PRs, or git.

## PR pipelines & previews

Path-filtered GitHub Actions (see `docs/pr-pipelines.md` / `SETUP.md`):

| Change set | CI | Preview (PR) | Production (`main`) |
| --- | --- | --- | --- |
| `apps/web/**` | `ci-web.yml`; also `chromatic.yml` + `playwright.yml` when web/packages paths hit | Path B ACA (`preview-web.yml`) via OIDC -> KV (`ssd-pocpk-aca-web-pr-<n>-ae`) | `deploy-web.yml` -> SWA production |
| `apps/api/**`, `pillars/**` | `ci-api.yml` | Path B ACA (`preview-api.yml`) via OIDC -> KV | `deploy-api.yml` -> App Service B1 |
| `apps/marketing/**` | `ci-web.yml` (marketing filter) | SWA PR preview (`preview-marketing.yml`, Free) via OIDC -> KV | `deploy-marketing.yml` -> marketing SWA (`apps/marketing/dist`) |
| `packages/**` | both CI workflows; Chromatic + Playwright when web deps change | web preview if web deps change; ACA preview if api/pillars touch packages | matching deploy workflows when paths hit |

- **Path B locked:** per-PR API previews (`ssd-pocpk-aca-pr-<n>-ae`) and web PR previews (`ssd-pocpk-aca-web-pr-<n>-ae`) on Container Apps Consumption, scale to zero. Shared F1 overwrite and S1 slots are rejected/deprecated for per-PR need. F1 App Service remains prod/dev host. Production web stays SWA Free.
- ACA auth: OIDC Variables only - `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` (no `AZURE_CREDENTIALS`).
- Local checks: pre-commit runs Prettier + ESLint on staged files only via `lint-staged` (never bypass with `--no-verify` for format/lint). Full-repo `pnpm format:check` / `pnpm lint` remain for humans/CI; also `pnpm test`, `pnpm build`. Manual staged check: `pnpm lint:staged`.
- Humans only merge; agents open PRs linking their GitHub issue (`Closes #N`) and run `pnpm pr:gate -- --pr <n>` to apply the `ready-for-human` label once mergeable/CI-green/feedback-clear (legacy ClickUp-tracked tickets still hand off via `./scripts/clickup.sh handoff` — see the "Legacy ClickUp workflow" section of `AGENTS.md`). Review bots provide PR feedback; humans validate the test plan and decide when the work is ready to merge.
- Production deploys use the same OIDC Variables + Key Vault pattern (no GitHub Secrets). API deploy needs **Website Contributor** on the App Service for the OIDC SP.

## Skills

Read curated skills under `.cursor/skills/` before coding (backend, frontend, test-generation, code-review, git-conventions, task-driven-development, etc.).

Discovery → delivery: `refine-idea` → `discover-requirements` → `idea-to-delivery` (multi-ticket) or `backlog-refinement` (one existing Delivery ticket). Do not file Delivery work while the idea or requirements are unresolved. These skills predate the GitHub Issues migration ([#170](https://github.com/singleton-sd/poc-plattform-kit/issues/170)/[#173](https://github.com/singleton-sd/poc-plattform-kit/issues/173)); once crossing the engineering boundary per `docs/github-source-of-truth.md` section 3, the output is a GitHub Issue, not a new ClickUp Delivery ticket.

## TDD / quality

- Write failing tests first for behavior changes.
- Update Swagger with API changes, then regenerate the client (`pnpm openapi:export && pnpm openapi:generate`).
- Forward-only Prisma migrations.
- UI: token CSS vars + Tailwind only - no hardcoded palette hex.

## Preview scenario delivery standard

Ephemeral API PR previews run against an isolated, disposable SQLite database seeded from named preview scenarios - see [`docs/preview-scenarios.md`](docs/preview-scenarios.md) for the full framework (registry, catalog, naming convention, CLI). This is the delivery requirement layered on top of it.

**A PR touching `apps/api/**`, `pillars/**`, or `packages/db/**` must declare its preview scenarios as a plain, visible line in the PR body** (not an HTML comment - easier for a human reviewer to spot, and doesn't depend on a hidden comment surviving whatever tool opened/edited the PR):

```text
Preview scenarios: pillar/tenant/settings, feature/my-feature/happy-path
```

or an explicit exemption with a reason, for changes that genuinely need no preview data (docs, CI/workflow-only, infra-only, a pure refactor with no behavior change):

```text
Preview scenarios: not-applicable - CI workflow tweak only, no data model or endpoint change
```

`.github/workflows/validate-preview-scenarios.yml` (`scripts/validate-preview-scenarios.mjs`) enforces this: it fails a PR that touches those paths with neither line present, rejects unknown scenario names with the full supported list, and proves every declared scenario actually seeds + verifies against a real throwaway SQLite database - not just that the declaration parses. `.github/pull_request_template.md` has the field already scaffolded.

**What each kind of ticket adds:**

- **Feature / pillar work:** add or extend a `pillar/<pillar>/<scenario>` (or `feature/<slug>/<scenario>`) scenario covering the meaningful states needed for acceptance - representative happy path plus applicable empty, permission/tenant-boundary, lifecycle, and error states. See `pillar/tenant/*` in `packages/db/scripts/scenarios/fixtures/tenant.mjs` for the pattern (multiple composable scenarios sharing a base via `dependsOn`, each with its own `verify()`).
- **A reproducible, data-dependent bug fix:** add a minimal `bug/<issue-number>/<scenario>` scenario (legacy ClickUp-tracked fixes may still use `bug/<clickup-task-id>/<scenario>`) that reproduces the pre-fix state, and keep it in the catalog after the fix lands as a regression fixture (its `verify()` should assert the corrected behavior). A preview scenario complements automated tests - it never replaces a regression/integration/contract/unit test.
- **SQL Server-specific changes** (native types, raw SQL, provider-specific migrations): still require SQL Server integration validation. Document in the PR what the SQLite preview cannot prove (see "Known SQLite vs SQL Server limitations" in the PR template).
- **Retiring a scenario:** remove it from `catalog.mjs` and its fixture module once nothing depends on it and it's no longer a meaningful regression/demo asset - don't leave dead scenarios registered "just in case."

Existing PRs/branches don't need a historical migration - the requirement applies going forward from when `validate-preview-scenarios.yml` is enabled.

## Issue-writing guidance for data-affecting work

When writing a GitHub Issue for `apps/api/**`, `pillars/**`, or `packages/db/**` work, include a short **Preview scenario** section in the issue body: which scenario(s) the implementation should add/update (or "not applicable" + why), and what a reviewer should be able to observe in the deployed preview once it's done. This lets issue -> PR -> preview stay traceable without inventing scenarios after the fact. (Legacy ClickUp-tracked tickets follow the same guidance in the ticket description.)

## Cursor Cloud specific instructions

pnpm workspace (`apps/*`, `packages/*`, `pillars/*`), Node 20+/pnpm 9. Root scripts (`package.json`) fan out with `pnpm -r`, so `pnpm lint`/`test`/`build` results depend on which feature PRs have merged - several `pillars/*` and `apps/web` may still be placeholder `echo` stubs on a given checkout (real coverage today is `apps/api` Jest + `packages/db` `prisma validate`). The update script's `pnpm install` picks up new deps automatically as that work lands. Note: multiple foundation PRs are in flight (tracked in GitHub Issues, see `docs/github-source-of-truth.md`) and touch `AGENTS.md`, tooling, `apps/web`, and pillars; expect this repo to evolve and don't treat the current stub state as final.

- **API (reliably runnable):** NestJS + Swagger. `pnpm dev:api` (watch) serves on `PORT` (default 3000): health `/health`, Swagger UI `/docs`, OpenAPI JSON `/docs-json`. No DB/Prisma wiring yet, so it runs without live Azure resources.
- **Web:** `pnpm dev:web` - Next.js PWA SPA (see `apps/web`).
- **Marketing:** `pnpm dev:marketing` - Astro SSG + Tailwind + Singleton SD tokens; Markdown in `apps/marketing/src/content/`; Decap static admin at `/admin` (OAuth proxy follow-up). Build emits `apps/marketing/dist`. See `docs/marketing-astro-decap.md`.
- **Prisma needs `DATABASE_URL`:** `packages/db` scripts (`prisma validate`/`generate`, invoked by `pnpm test`/`pnpm build`) fail without it. Prisma reads `.env` from its own dir (cwd = `packages/db`), NOT the repo root, so the gitignored placeholder lives at `packages/db/.env` (created by the update script). Real value is in Azure Key Vault (`ssd-pocpk-kv-dev-ae`); the placeholder only covers schema validate/generate, not live queries.
- **If `pnpm build` fails in `packages/events`** (build runs `tsc -p tsconfig.json`): older `main` is missing `packages/events/tsconfig.json` + a `typescript` dep; a pending ClickUp-tracked PR adds them. Until it merges, build the API directly with `pnpm --filter @poc-plattform-kit/api build`.
- **`pnpm sync:skills` is Windows-only** (PowerShell); skip on Linux — skills are already committed under `.cursor/skills/`.
- **Legacy ClickUp access** (existing ClickUp-tracked tickets only — see the "Legacy ClickUp workflow" section): prefer [`scripts/clickup.ps1`](scripts/clickup.ps1) / [`scripts/clickup.sh`](scripts/clickup.sh) + `CLICKUP_API_TOKEN`. Raw REST also fine. Do **not** use ClickUp MCP for routine ops. On 429, stop. Don't assign/move/merge tickets unless claiming or handing off.
