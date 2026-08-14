# Curated skills

Committed skills for **Cursor Agent** (implement / local review loops).

## Synced from the skills repo

Refresh the shared set:

```powershell
pnpm sync:skills
```

Source: `C:\00Personal\singleton-sd\ai-plattform\skills`  
Expected: task-driven-development, task-management, backend, frontend, schema-driven-forms, form-ux, test-generation, code-review, git-conventions, repo-init, backlog-refinement, refine-idea, discover-requirements, idea-to-delivery

## Kit-local skills (this repo only)

These are authored and committed here; they are **not** in the `pnpm sync:skills` allowlist (a sync would not overwrite them unless someone adds them later by mistake — keep kit-only skills out of that script).

| Skill | Purpose |
| --- | --- |
| [`forward-email`](forward-email/SKILL.md) | Forward Email domain/DNS/token provisioning |
| [`pr-agent-wake`](pr-agent-wake/SKILL.md) | Fix an existing PR after `ci-failed` / `has-feedback` |
| [`register-permissions`](register-permissions/SKILL.md) | Register OpenFGA catalog entries for new models/routes |
| [`agent-orchestration`](agent-orchestration/SKILL.md) | Multi-agent / worktree orchestration helpers |
| [`discover-public-apis`](discover-public-apis/SKILL.md) | Brainstorm externally-enabled product capabilities and validate public API/provider options |

**Bugbot does not load these skills.** PR review rules live in `.cursor/BUGBOT.md` (and nested `**/BUGBOT.md`). Distill review-critical checks there; do not point Bugbot at `ai-plattform-skills`.

**Engineering tracker: GitHub, not ClickUp.** Per
[`docs/github-source-of-truth.md`](../../docs/github-source-of-truth.md)
([#171](https://github.com/singleton-sd/poc-plattform-kit/issues/171),
[#173](https://github.com/singleton-sd/poc-plattform-kit/issues/173)), the
engineering-execution skills in this set (`task-driven-development`,
`task-management`, `agent-orchestration`, `backlog-refinement`,
`idea-to-delivery`, `refine-idea`, `discover-requirements`,
`git-conventions`, `pr-agent-wake`) claim, plan, and hand off work through
**GitHub Issues and pull requests** — no ClickUp ID or ClickUp status is
required to perform engineering work. This is a local repository
customization of the synced skill content, not a change to the sync
mechanism itself; re-running `pnpm sync:skills` still refreshes the base
skill files from the source repo above, so re-apply the GitHub-native
routing sections in this repo's copies after a sync if the upstream source
skill still describes ClickUp routing.
