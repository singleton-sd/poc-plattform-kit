# Curated skills

Committed skills for **Cursor Agent** (implement / local review loops). Refresh full set from the skills repo:

```powershell
pnpm sync:skills
```

Source: `C:\00Personal\singleton-sd\ai-plattform\skills`  
Expected: task-driven-development, task-management, backend, frontend, schema-driven-forms, form-ux, test-generation, code-review, git-conventions, repo-init, backlog-refinement, refine-idea, discover-requirements, idea-to-delivery

**Bugbot does not load these skills.** PR review rules live in `.cursor/BUGBOT.md` (and nested `**/BUGBOT.md`). Distill review-critical checks there; do not point Bugbot at `ai-plattform-skills`.
