---
name: Git Conventions
description: Apply Singleton SD git conventions — commit format, branch naming, and ticket linking
tags: [engineering, git, conventions, commits, workflow]
audience: [engineers, tech-leads]
status: stable
---

# Git Conventions

You are a senior engineer helping enforce Singleton SD's git conventions. Apply these rules when writing commit messages, naming branches, or reviewing either.

## This repository

`poc-plattform-kit` identifies engineering work by **GitHub issue number**
(`#173`), not a ClickUp custom id or `SSDOP-N`. See
[`docs/github-source-of-truth.md`](../../../docs/github-source-of-truth.md)
section 6 for the authoritative branch/PR/issue policy; this section only adds the
matching commit-message convention.

Branch naming:

```text
<type>/<issue-number>-<kebab-title>
```

Examples: `feat/184-support-ticket-api`, `fix/211-login-redirect`,
`docs/171-github-engineering-source-of-truth`. `<type>` is a
conventional-commit prefix matching the primary nature of the change (see
the type table below).

Worktrees live beside the clone: `../worktrees/<issue-number>-<kebab-title>`.
Create them with `pnpm worktree:add -- -TaskId <issue-number> -Slug <kebab-title>`
(Linux/Cloud: `./scripts/add-worktree.sh --task-id <issue-number> --slug <kebab-title>`)
— the flag is positional tooling for the worktree folder name, not a
ClickUp lookup.

### Commit message format (this repository)

```
type: #<issue-number> Description in sentence case
```

Example:

```
feat: #184 Add dark mode toggle to settings page
```

A commit that is not tied to a single issue (a small unattributed fix, a
release commit) may omit the `#<issue-number>` — do not invent an issue
number to satisfy the format. What actually closes the issue on merge is
the `Closes #<issue-number>` line in the **PR body**
(`docs/github-source-of-truth.md` section 6), not the commit message.

The `SSDOP-42` examples in the rest of this document are the generic
company-wide convention for other repositories; do not use that ticket
format here — use the GitHub issue number as shown above instead.

---

## Commit message format

```
type: TICKET-NUMBER Description in sentence case
```

Examples:
```
feat: SSDOP-42 Add dark mode toggle to settings page
fix: SSDOP-17 Resolve null pointer in token parser
chore: SSDOP-99 Update dependencies to latest versions
```

### Rules

| Rule | Requirement |
|------|-------------|
| Format | `type: TICKET-NUMBER Description` |
| Subject case | Sentence-case — first letter capitalized, rest lowercase |
| Subject max length | 50 characters |
| Subject ending | No period `.` at end |
| Ticket presence | Required in commit message **or** inferrable from branch name |
| Ticket format | `[A-Z]{1,5}-[0-9]{1,5}` — e.g. `SSDOP-42`, `PROJ-7` |
| Body separator | Blank line between subject and body (if body is present) |
| Body line length | Max 72 characters per line |
| Release commits | Skipped — format is `chore: Release package versions` (auto-generated; body lists `@scope/name@version` tags) |

### Commit body: 72-character lines

When the commit has a **body** (paragraphs or bullet list):

- **Every** body line must be **≤ 72 characters** (count spaces and punctuation).
- That includes lines that start with a bullet (`- `): the whole line must stay
  within the limit; wrap long bullets onto continuation lines if needed.
- Prefer breaking at natural phrase boundaries, not mid-word.

Example (subject obeys 50-character limit; each body line ≤ 72):

```
chore: SSDOP-42 Add parallel TS build driver

- Parallel: generate-html, manifest icons, and profile pipeline
- Profile: static assets, then animations (PNG cache reuse)
- Run build via ts-node instead of bash for portability
```

### Ticket auto-injection

The `prepare-commit-msg` hook automatically injects the ticket number from the branch name. If you are on `feature/SSDOP-42-dark-mode`, writing:
```
feat: Add dark mode toggle
```
becomes:
```
feat: SSDOP-42 Add dark mode toggle
```

You only need to include the ticket explicitly when:
- You are on a non-feature/hotfix branch (e.g., `develop`)
- The ticket in your commit differs from the branch (this will error — fix the mismatch)

### Allowed types (conventional commits)

| Type | When to use |
|------|-------------|
| `feat` | New feature or user-facing behaviour |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace — no logic change |
| `refactor` | Restructure without changing behaviour |
| `perf` | Performance improvement |
| `test` | Add or update tests |
| `ci` | CI/CD pipeline changes |
| `chore` | Build scripts, tooling, dependency updates |
| `revert` | Reverting a previous commit |

---

## Branch naming

```
feature/TICKET-NUMBER[-optional-slug]
hotfix/TICKET-NUMBER[-optional-slug]
release/vMAJOR.MINOR.PATCH
```

Also allowed (protected):
```
main    master    develop    design
```

Examples:
```
feature/SSDOP-42
feature/SSDOP-42-dark-mode-toggle
hotfix/SSDOP-17
hotfix/SSDOP-17-null-pointer-fix
release/v1.3.0
```

The `post-checkout` hook validates branch names on creation. Invalid branches are automatically deleted and the previous branch is restored.

---

## TypeScript filename conventions

Staged `.ts` files must match one of these patterns:

| Pattern | Example |
|---------|---------|
| `kebab-case.ts` | `token-parser.ts` |
| `kebab-case.spec.ts` | `token-parser.spec.ts` |
| `kebab-case.test.ts` | `token-parser.test.ts` |
| `PascalCase.ts` | `TokenParser.ts` |
| `PascalCase.d.ts` | `TokenParser.d.ts` |

The `pre-commit` hook blocks commits containing files that don't match.

---

## Versioning

Versions follow **semver** and are bumped automatically by `release-it` based on commit types:

| Commit type | Version bump |
|-------------|-------------|
| `fix:` | Patch (`1.2.3` → `1.2.4`) |
| `feat:` | Minor (`1.2.3` → `1.3.0`) |
| `BREAKING CHANGE:` in footer | Major (`1.2.3` → `2.0.0`) |

Never manually edit the version in `package.json`. Run `pnpm release` (dry-run)
or `pnpm release:ci` (CI on `main`) instead. Releases are **path-aware and
independent** per workspace package; tags look like
`@poc-plattform-kit/api@0.1.0`. Production deploys run from the aggregated
`chore: Release package versions` commit.

---

## Validation checklist

Before pushing, verify:
- [ ] Branch name matches `feature/TICKET-NNN` or `hotfix/TICKET-NNN` or an allowed base branch
- [ ] Commit subject is ≤ 50 chars, sentence-case, no period
- [ ] Ticket number is present (in commit or auto-injected from branch)
- [ ] Body lines (if any) are ≤ 72 chars with a blank separator line
- [ ] TypeScript filenames follow kebab-case or PascalCase
- [ ] Pre-commit ran `lint-staged` (Prettier + ESLint on staged files only) —
  do not skip hooks with `--no-verify` for format/lint failures
