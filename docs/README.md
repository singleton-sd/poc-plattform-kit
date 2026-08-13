# Documentation map

Repository documentation is the authoritative source for engineering
technical knowledge — architecture, conventions, runbooks, pipelines. Not
ClickUp. See [`docs/github-source-of-truth.md`](./github-source-of-truth.md)
section 1 for the exact system-ownership boundary this follows, and section 7 for what
must never appear here (secrets, customer-private data, pricing, contracts,
commercial roadmap — that stays in ClickUp).

This page exists so an implementation agent can find the right doc without
grepping the directory or opening ClickUp. If you add a new `docs/**` file,
add a row here.

## Start here

- New to the system? Read
  [`docs/architecture/overview.md`](./architecture/overview.md) first — it's
  the narrative map of pillars, data flow, auth, and deployment, and links
  out to every topic doc below for detail.
- Working across pillars, or unsure whether a rule applies to your change?
  [`docs/architecture/engineering-principles.md`](./architecture/engineering-principles.md)
  is the cross-cutting rules summary.
- Deciding what kind of test to write? [`docs/development/testing-strategy.md`](./development/testing-strategy.md).
- Wondering why something is built the way it is (and whether that's still
  the reason)? Check [`docs/adr/`](./adr/) before re-deciding it.
- Working on the engineering GitHub-migration project itself (issues #170–
  #178)? [`docs/github-source-of-truth.md`](./github-source-of-truth.md) is
  the policy document for that.

## Structure

```text
docs/
├── README.md                 (this file)
├── github-source-of-truth.md (engineering lifecycle policy)
├── architecture/              narrative synthesis docs (overview, principles)
├── adr/                       settled, platform-wide architecture decisions
├── development/               how to build/test/verify a change
├── discovery/                  in-flight feature-level discovery ADRs (not settled platform decisions — see docs/adr/README.md)
└── <topic>.md                 flat topic docs (existing convention; see table below)
```

`docs/` is a flat directory of topic files by long-standing convention, with
new `architecture/`, `adr/`, and `development/` subfolders added for content
that didn't have an existing home. The existing flat files were **not**
moved into subfolders as part of introducing this structure — see
"Why the existing files weren't reorganized" below.

## Architecture

| Doc | Covers |
| --- | --- |
| [`architecture/overview.md`](./architecture/overview.md) | Pillar map, cross-pillar communication, multitenancy, AuthN/AuthZ, data/persistence, HTTP contract, frontend surfaces, deployment topology, observability |
| [`architecture/engineering-principles.md`](./architecture/engineering-principles.md) | Cross-cutting rules: pillar boundaries, audit/outbox, migrations, secrets, cost/SKU posture, centralized AuthZ, public/private boundary, TDD |

## Architecture decision records

| Doc | Decision |
| --- | --- |
| [`adr/0001`](./adr/0001-pillar-isolation-and-event-driven-integration.md) | Pillar isolation with event-driven cross-pillar integration |
| [`adr/0002`](./adr/0002-openfga-fine-grained-authorization.md) | OpenFGA for fine-grained authorization, separate from Entra coarse roles |
| [`adr/0003`](./adr/0003-sqlite-seeded-preview-databases.md) | SQLite-seeded ephemeral databases for API PR previews |
| [`adr/0004`](./adr/0004-cross-subdomain-cookie-auth-swa-free.md) | Cross-subdomain session cookies instead of SWA Standard app-linking |

See [`adr/README.md`](./adr/README.md) for the ADR format and when to add a
new one (vs. a `docs/discovery/` proposal instead).

## Development

| Doc | Covers |
| --- | --- |
| [`development/testing-strategy.md`](./development/testing-strategy.md) | Which test layer proves what (unit, scenario, Storybook/Chromatic, Playwright, preview), and how to pick one |

## Topic docs (existing)

| Doc | Covers |
| --- | --- |
| [`chromatic.md`](./chromatic.md) | Chromatic visual regression workflow |
| [`client-changelog.md`](./client-changelog.md) | Client-facing changelog workflow |
| [`db-practices.md`](./db-practices.md) | Database ownership, multi-tenancy, migrations, outbox pattern |
| [`dns-route53.md`](./dns-route53.md) | Custom domains — Route53 + Azure CNAME wiring |
| [`dto-mapping.md`](./dto-mapping.md) | DTO ↔ entity mapping conventions |
| [`email-forward-email.md`](./email-forward-email.md) | Forward Email provider integration + DNS provisioning |
| [`form-ux-audit.md`](./form-ux-audit.md) | Form UX audit findings |
| [`github-source-of-truth.md`](./github-source-of-truth.md) | Engineering system-of-record policy (ClickUp → GitHub migration) |
| [`marketing-astro-decap.md`](./marketing-astro-decap.md) | Marketing site — Astro + Decap CMS |
| [`marketing-edge.md`](./marketing-edge.md) | Marketing edge public HTTP (Function App, not Nest) |
| [`openapi-client.md`](./openapi-client.md) | OpenAPI contract + generated client flow |
| [`permissions.md`](./permissions.md) | Permissions/OpenFGA catalog and workflow |
| [`playwright.md`](./playwright.md) | Playwright browser-journey scope and setup |
| [`pr-pipelines.md`](./pr-pipelines.md) | PR CI/preview pipelines |
| [`preview-scenarios.md`](./preview-scenarios.md) | Preview scenario framework (SQLite seeding) |
| [`sso.md`](./sso.md) | SingleSignOn — Entra JWT + Auth.js cookies |
| [`storybook.md`](./storybook.md) | Storybook baseline catalogue |
| [`telemetry.md`](./telemetry.md) | Telemetry / observability |

## Discovery

[`discovery/`](./discovery/) holds in-flight, feature-level discovery
documents (currently: API error contract, support ticket workflow, support
impersonation, and their consolidated roadmap) — proposals working toward
implementation-readiness, distinct from the settled, platform-wide decisions
in `docs/adr/`. See [`adr/README.md`](./adr/README.md) for how the two
folders relate.

## Why the existing files weren't reorganized

The candidate structure for this migration (issue #175) suggested
`architecture/`, `adr/`, `development/`, `operations/`, and `product/`
subfolders. This pass added the three that have real content today
(`architecture/`, `adr/`, `development/`) without moving the 17 existing
flat topic files into them, and did not create `operations/` or `product/`
since nothing new justified them yet. Reasoning:

- Moving files would touch every cross-link into them from `AGENTS.md`,
  `SETUP.md`, `README.md`, and other `docs/**` files — a large, link-fragile
  diff for a rename with no behavior change, and the risk outweighs the
  marginal navigability gain right now, given the docs index above already
  gives a topic-based way to find anything without a folder move.
- If a future pass wants the full candidate structure, it can move files in
  a dedicated, low-risk PR that touches only link updates — this page's
  structure section documents that as a live option, not a rejected one.

## Migrating remaining ClickUp technical content

This pass could not reach the ClickUp Architecture Doc
(`https://app.clickup.com/90161394355/docs/2kz0kcnk-1416`) or the ClickUp
Docs folder (`https://app.clickup.com/90161394355/v/f/901610744236/90165834867`)
directly (no ClickUp credentials in this session) and did not invent their
content. Where this repository's own code, `AGENTS.md`, and existing
`docs/**` files already gave enough evidence to write an accurate,
grounded doc (this page's new `architecture/`, `adr/`, and `development/`
content, plus the `telemetry.md` authority fix), that content was written
directly. Anything in those two ClickUp locations not already reflected
somewhere in this repository is flagged as a follow-up requiring ClickUp
access, tracked as a GitHub issue rather than guessed at here — see the
migration PR description for the current issue link.
