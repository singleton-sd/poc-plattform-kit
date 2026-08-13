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

**Bugbot does not load these skills.** PR review rules live in `.cursor/BUGBOT.md` (and nested `**/BUGBOT.md`). Distill review-critical checks there; do not point Bugbot at `ai-plattform-skills`.
