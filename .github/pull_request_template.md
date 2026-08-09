<!--
[repo=singleton-sd/poc-plattform-kit]

Preview scenario declaration (required for apps/api/**, pillars/**, packages/db/**
changes — see docs/preview-scenarios.md and AGENTS.md "Preview scenario delivery
standard"). Uncomment exactly one of the two blocks below and fill it in; CI
(validate-preview-scenarios.yml) rejects a PR that touches those paths with
neither block present, an unknown scenario name, or a scenario that fails to
seed.

Declaring scenarios:
<!-- preview-scenarios: pillar/tenant/settings, pillar/x/y -->

Exemption (only when the change genuinely needs no preview data — docs,
CI/workflow-only, infra-only, etc.):
<!-- preview-scenario: not-applicable: <reason> -->
-->

## Summary

<!-- What changed and why. -->

## Preview scenarios

- **Scenario(s):** <!-- e.g. pillar/tenant/settings, or "not-applicable: <reason>" -->
- **Preview test instructions:** <!-- exact steps a reviewer follows in the deployed preview -->
- **Expected result:** <!-- what the reviewer should see -->
- **Known SQLite vs SQL Server differences:** <!-- anything this preview can't prove; "none" if not applicable -->

## Test plan

<!-- Automated tests added/updated. A preview scenario complements tests, it never replaces them. -->

## Checklist

- [ ] Tests added/updated for the behaviour change
- [ ] Preview scenario declared above (or a justified `not-applicable` exemption)
- [ ] Docs updated if the change affects a documented contract or workflow
