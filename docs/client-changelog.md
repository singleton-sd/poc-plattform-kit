# Client-facing changelog workflow

The API, app, and marketing site publish release notes from the same conventional commit
messages that drive version bumps. Product changelogs are generated files; contributors
should describe the user-visible change and its reason in the commit message instead of
editing a release section by hand.

## Where release notes appear

| Product | Canonical history | Client-facing projection | Published location |
| --- | --- | --- | --- |
| API | `apps/api/CHANGELOG.md` | `apps/api/src/changelog/changelog.json` | `GET /changelog` |
| App | `apps/web/CHANGELOG.md` | `apps/web/src/content/changelog.json` | `/changelog` |
| Marketing | `apps/marketing/CHANGELOG.md` | `apps/marketing/src/data/changelog.json` | `/changelog` |

The root `CHANGELOG.md` remains the workspace-level version-bump index. It links to the
three detailed product histories but is not their source.

## Write a client-facing commit

Use a conventional commit subject. Only these types become public release-note entries:

| Commit | Public group | Version effect |
| --- | --- | --- |
| `feat:` | New | Minor |
| `fix:` | Fixed | Patch |
| `perf:` | Improved | Patch |
| `feat!:` or a `BREAKING CHANGE:` footer | Breaking | Major |

The subject becomes the short client-facing summary. The first explanatory prose line in
the body becomes the reason shown beneath it. Ticket IDs and a trailing pull-request
number are removed from the public summary.

```text
feat(changelog): 86d3example Let customers filter release notes (#123)

Customers can find changes for the product they use without scanning unrelated releases.
```

This produces:

```text
New
Let customers filter release notes
Customers can find changes for the product they use without scanning unrelated releases.
```

Keep the subject understandable without internal context, and use the body to answer
**why the change helps a client**. Bullets, headings, ticket references, and co-author
trailers are not selected as the reason. Commits such as `docs:`, `test:`, `chore:`, and
non-breaking `refactor:` do not create a public entry or version bump. Any conventional
commit can declare a breaking change, which creates a major bump and a public entry.

## How a release updates the files

1. The release orchestrator finds changed workspaces and reads conventional commits since
   each workspace's latest tag.
2. It calculates the semantic version bump and uses the same commits to prepend the new
   API, app, or marketing release to that project's Markdown history.
3. It regenerates the corresponding JSON projection from the canonical Markdown.
4. It updates the root version-bump index, commits all release files, and then creates the
   annotated product tags.
5. CI runs `pnpm changelog:test` and `pnpm changelog:check` to reject malformed, stale, or
   out-of-order projections.

Only commits touching a product's watched paths are included. Shared `packages/**` changes
can appear in both API and app releases; marketing entries come from `apps/marketing/**`.

## Verify before merge

Run the changelog unit tests and projection check from the repository root:

```bash
pnpm changelog:test
pnpm changelog:check
```

To preview the releases reconstructable from existing tags without changing files:

```bash
git fetch origin --tags
pnpm changelog:backfill:dry-run
```

Use `pnpm changelog:backfill` only when intentionally reconstructing all three histories.
It rewrites the canonical Markdown and JSON from tagged commits. Before writing any files,
it validates that the local tag set covers every version already recorded for the API, app,
and marketing changelogs. If any product is incomplete, the command fails without rewriting
the others.

## Troubleshooting

- **A release has no public entries:** confirm the relevant commit uses `feat`, `fix`,
  `perf`, or a breaking-change marker and touches the product's watched paths.
- **The change has no “why” text:** add explanatory prose to the commit body; metadata and
  Markdown list lines are intentionally ignored.
- **The projection check reports drift:** do not edit JSON directly. Regenerate it through
  the release/backfill tooling so it matches the canonical product Markdown.
- **Backfill reports missing tags:** run `git fetch origin --tags` and retry. Do not bypass
  the completeness check because a partial tag set would truncate historical versions.
