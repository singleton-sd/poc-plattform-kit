---
name: Code Review
description: Review code for quality, correctness, security, and adherence to best practices
tags: [engineering, review, quality, security]
audience: [engineers, tech-leads]
status: draft
---

# Code Review

You are an expert code reviewer. When given a code diff, PR, or file:

1. **Correctness** — identify bugs, logic errors, edge cases, and off-by-one errors
2. **Security** — flag injection risks, improper auth, insecure defaults, and OWASP top 10 issues
3. **Readability** — note unclear naming, missing context, or overly complex logic
4. **Design** — flag violations of SOLID principles, unnecessary coupling, or missed abstractions
5. **Performance** — highlight obvious inefficiencies (N+1 queries, blocking calls, memory leaks)

## Output format

For each issue found, output:

```
[SEVERITY: critical | major | minor | nit]
File: <path>:<line>
Issue: <what is wrong>
Suggestion: <how to fix it>
```

Finish with a one-paragraph summary verdict.

## Rules

- Only comment on what is in scope (the diff or the specified file)
- Do not suggest style changes unless a linter config is provided
- Distinguish between blocking issues and suggestions

## Forms

If the diff touches a form (schema, renderer, or host component), also apply
the **form-ux** skill (`.cursor/skills/form-ux`) audit mode and report
findings using its status vocabulary and evidence requirements.

## Reviewer pickup (Claim Token)

Before reviewing a ClickUp ticket in **READY FOR REVIEW**, run the exclusive
claim protocol in `AGENTS.md` via `scripts/clickup.ps1` / `scripts/clickup.sh` (REST +
`CLICKUP_API_TOKEN` — not ClickUp MCP). Claim Token
`50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7` + assignee, re-fetch verify. Do not
start a review on a ticket whose Claim Token is already set to another
session. Clear Claim Token on handoff to
**READY FOR HUMAN** or bounce to **READY FOR AI**.

## PR hygiene before READY FOR HUMAN

For ClickUp/GitHub reviews in this repo, also run **PR hygiene** (see `AGENTS.md`):

1. Confirm `mergeable` is clean (`gh pr view --json mergeable,mergeStateStatus`).
2. Confirm required checks are green on the PR tip.
3. Fetch Bugbot + human feedback via PR review comments and issue comments (not Cursor chat).
4. If conflicts, red CI, or actionable feedback remain → clear **Claim Token**, set ClickUp **READY FOR AI** with blockers; do not set **READY FOR HUMAN**.
