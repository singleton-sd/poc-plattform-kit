# Architecture decision records

This folder holds settled **platform-level** architecture decisions: things
that are already implemented, "locked" (see `AGENTS.md` / `docs/**`
conventions using that word), and would need a new ADR to change rather than
a quiet edit to a config file.

An ADR here records **why**, not just **what**. The what (current
configuration, exact resource names, exact env vars) belongs in the topic
doc it's linked from (`docs/architecture/overview.md`, `infra/README.md`,
`docs/sso.md`, etc.) and should be updated there as the system evolves — an
ADR's "Decision" section is a snapshot of the choice made, not a living
config reference, and is not kept in lockstep with later renames.

## When to add one here

Add an ADR when a decision:

- Was genuinely contested (a real alternative existed and was rejected), and
- Constrains future work (someone could plausibly propose reversing it), and
- Is platform-wide or cross-pillar, not local to one feature.

Feature-level or workstream-level decisions (e.g. a specific pillar's error
contract, a specific discovery spike's outcome) belong in
[`docs/discovery/`](../discovery/) instead, following the pattern already
used there (see e.g. `docs/discovery/api-error-contract.md`). Keep the two
folders distinct rather than duplicating a decision in both: `docs/adr/` is
settled, platform-wide, and implemented; `docs/discovery/` is proposed,
feature-scoped, and may still be pending approval gates.

## Format

Each ADR is a numbered Markdown file: `NNNN-kebab-title.md`. Use the next
unused number. Sections:

- **Status** — `Accepted` (this repo doesn't currently use `Proposed` /
  `Superseded` here; use `docs/discovery/` for proposals instead).
- **Context** — the problem/constraint that forced a choice.
- **Decision** — what was chosen, in one or two sentences.
- **Alternatives considered** — what else was on the table and why it lost.
- **Consequences** — what this makes easy, what it makes hard, what it costs.
- **References** — links to the repo docs/code that implement the decision.

## Index

| ADR | Title |
| --- | --- |
| [0001](./0001-pillar-isolation-and-event-driven-integration.md) | Pillar isolation with event-driven cross-pillar integration |
| [0002](./0002-openfga-fine-grained-authorization.md) | OpenFGA for fine-grained authorization, separate from Entra coarse roles |
| [0003](./0003-sqlite-seeded-preview-databases.md) | SQLite-seeded ephemeral databases for API PR previews |
| [0004](./0004-cross-subdomain-cookie-auth-swa-free.md) | Cross-subdomain session cookies instead of SWA Standard app-linking |
