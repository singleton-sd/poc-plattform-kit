# Testing strategy

This page maps out **which kind of test proves what**, so an implementation
agent can pick the right layer instead of reaching for the one it happens to
know. Each layer already has its own detailed doc for exact commands/setup —
this page is the index and the "why this layer, not that one" reasoning.
TDD is the default workflow, not one option among several: write a failing
test before changing behavior (`AGENTS.md`'s "TDD / quality" section).

## The layers

| Layer | Tool | Proves | Doc |
| --- | --- | --- | --- |
| Unit / component logic | Jest | A function/class/module behaves correctly in isolation | (per-package `*.spec.ts` / `*.test.ts`; no dedicated doc yet — see `apps/api` for the current reference implementation) |
| Schema / migration validation | `prisma validate` | The Prisma schema is internally consistent | `packages/db` scripts (invoked by `pnpm test` / `pnpm build`) |
| DB scenario integration | `packages/db` scenario tests | A named preview scenario actually seeds and verifies against a real (temporary) SQLite database | [`docs/preview-scenarios.md`](../preview-scenarios.md)'s "Testing" section |
| Component visual states | Storybook + Chromatic | A component renders correctly across its meaningful states, and hasn't regressed visually | [`docs/storybook.md`](../storybook.md), [`docs/chromatic.md`](../chromatic.md) |
| Full-application browser journeys | Playwright | A small set of real end-to-end journeys work in a real browser | [`docs/playwright.md`](../playwright.md) |
| Deployed-preview acceptance | Seeded PR preview (SQLite) | A reviewer (human or bot) can exercise a real deployed instance of the change | [`docs/preview-scenarios.md`](../preview-scenarios.md), [`docs/pr-pipelines.md`](../pr-pipelines.md) |

None of these layers substitutes for another. In particular: a preview
scenario demonstrates a state to a reviewer — it is a delivery/review aid,
never a replacement for a unit, integration, contract, or regression test
covering the same behavior (see `AGENTS.md`'s "Preview scenario delivery
standard" section).

## Picking a layer

- **Changing business logic in a pillar or shared package** → unit tests
  first (TDD), Jest. This is the default and usually sufficient on its own
  for pure logic.
- **Changing the Prisma schema or a migration** → `prisma validate` (via
  `pnpm test` / `pnpm build`) plus a scenario integration test if the
  change affects seeded/verified data shapes.
- **Adding or changing an API endpoint, or a pillar's data model** → unit
  tests for the logic, an OpenAPI export/regenerate pass (see
  [`docs/openapi-client.md`](../openapi-client.md)) if the contract
  changed, and a declared preview scenario so the change is reviewable on
  the deployed PR preview.
- **Changing a UI component's visual states** → a Storybook story per
  meaningful state (including empty/error states for API-driven screens)
  and let Chromatic catch visual regressions — see
  [`docs/storybook.md`](../storybook.md)'s "Definition of Done" section.
- **Changing a cross-page or cross-feature user flow** → only if it's
  within Playwright's deliberately small initial scope (signed-out
  boot/navigation journeys today) does it belong there; most flows are
  covered at the unit + Storybook + preview-scenario layers instead. See
  [`docs/playwright.md`](../playwright.md)'s "Initial scope before adding a
  new Playwright journey" section — it is intentionally not the default place to add
  coverage.
- **A data-dependent bug fix** → add a minimal `bug/<ticket-id>/<scenario>`
  preview fixture that reproduces the pre-fix state and keep it as a
  regression fixture after the fix lands, **in addition to** a regression
  test at the appropriate layer above — the preview fixture makes the bug
  reviewable, the test makes the fix durable.

## Known gap: SQL Server-specific behavior

Preview scenarios run on SQLite (see
[ADR 0003](../adr/0003-sqlite-seeded-preview-databases.md)), so they cannot
prove SQL Server-specific behavior: native `@db.*` types, raw SQL, collation,
locking, or concurrency/performance characteristics. A change that relies on
any of those still needs real Azure SQL integration validation as a
separate step, and the PR should say explicitly what the SQLite preview
could not prove (the PR template has a field for this).

## Local commands

```bash
pnpm test          # fans out pnpm -r test — Jest suites + prisma validate + scenario tests
pnpm build         # fans out pnpm -r build
pnpm lint          # full-repo ESLint (pre-commit only lints staged files via lint-staged)
pnpm format:check  # full-repo Prettier check
```

`pnpm test` / `pnpm build` results depend on which pillars/apps have real
implementations yet versus placeholder stubs on a given checkout — see the
"Cursor Cloud specific instructions" section of `AGENTS.md` for the current
state of that.
