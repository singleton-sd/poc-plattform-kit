<!--
Preview scenario declaration (required for apps/api/**, pillars/**, packages/db/**
changes — see docs/preview-scenarios.md and AGENTS.md "Preview scenario delivery
standard"). Fill in the "Preview scenarios:" line below with either:

  Preview scenarios: pillar/tenant/settings, pillar/x/y

or an explicit exemption with a reason, for changes that genuinely need no
preview data (docs, CI/workflow-only, infra-only, a pure refactor):

  Preview scenarios: not-applicable — CI workflow tweak only, no data model or endpoint change

This must be a plain, visible line (not an HTML comment) — easier for a
human reviewer to spot, and doesn't depend on a hidden comment surviving
whatever tool opened or edited the PR. CI (validate-preview-scenarios.yml)
rejects a PR that touches those paths without this line filled in, an
unknown scenario name, or a scenario that fails to seed.
-->

## Summary

- What changed and why?
- Where is the new or changed behavior?

## Preview scenarios

Preview scenarios: <!-- fill in above, see the instructions at the top of this description -->

- **Known SQLite vs SQL Server differences:** <!-- anything this preview can't prove; "none" if not applicable -->

## Test plan

<!-- Write this for the human who will validate the PR. Do not only list CI commands. -->

### Setup

- Preview URL, environment, account/role, feature flag, or test data required:

### Steps and expected results

1. Go to the exact page, route, API endpoint, or workflow.
   - **Expected:** Describe the observable result.
2. Exercise an important alternate or error path.
   - **Expected:** Describe the observable result.

## Feedback focus

- Which behavior, screen, API contract, or design decision should the human
  comment on?
- If there is no user-facing behavior, state that here and identify the files
  or automation output to inspect instead.

## Automated checks

- `command` — result
