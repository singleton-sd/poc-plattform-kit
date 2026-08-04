# Ticket draft — Adapt repo-init / git-conventions

> ClickUp API was rate-limited when creating this task. Paste into list `901616287298` as **TO DO** when API recovers.

`[repo=singleton-sd/poc-plattform-kit]`

## Goal

Adapt `/repo-init` and `/git-conventions` for this repo so husky/commitlint/release tooling matches locked Platform Kit conventions (do **not** apply stock SSDOP/yarn/GitLab as-is).

## Why

Skills under `.cursor/skills/repo-init` and `git-conventions` expect yarn, `SSDOP-42`-style tickets, and often GitLab. This repo uses **pnpm**, ClickUp ids like **`86d3x7q3t`**, and **GitHub**. Agents must stop applying stock rules blindly.

## Acceptance

- [ ] Document adapted conventions in `AGENTS.md` / `SETUP.md` (pnpm, ClickUp id in branch + commit subject)
- [ ] Adapt or fork skills / hook scripts for:
  - **pnpm** (not yarn); Windows-safe husky hooks
  - Ticket regex = ClickUp custom id (`86d…` / alphanumeric), not only `[A-Z]{1,5}-\d{1,5}`
  - Branch pattern stays `feature/<clickup-task-id>-<kebab-title>` (AGENTS locked)
  - commitlint + prepare-commit-msg aligned with that pattern
- [ ] **release-it** uses GitHub (or defer until first tag is needed)
- [ ] Optional: husky + commitlint wired in `package.json` (`prepare`, release scripts) once regex is correct
- [ ] No secrets committed; no GitLab CI copied in

## Out of scope

- Full product release pipeline
- Changing ClickUp list/space

## Notes

Stock skill files may stay upstream; prefer repo-local adaptations under `.cursor/skills/` or documented overrides so sync from ai-plattform-skills does not overwrite without review.
