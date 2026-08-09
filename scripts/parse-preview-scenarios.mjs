#!/usr/bin/env node
// Extracts a PR's declared preview scenario selection from its body.
// See docs/preview-scenarios.md and AGENTS.md for the full delivery
// requirement; this script only implements the parsing convention:
//
//   <!-- preview-scenarios: pillar/tenant/settings, pillar/x/y -->
//   <!-- preview-scenario: not-applicable: <reason> -->
//
// Used by .github/workflows/preview-api.yml to compute the
// PREVIEW_SEED_SCENARIOS build-arg, and by the CI scenario-declaration
// check (validate-preview-scenarios.mjs) to enforce the requirement.
//
// Usage:
//   node scripts/parse-preview-scenarios.mjs < pr-body.txt        # prints resolved CSV (never empty; defaults to "demo")
//   node scripts/parse-preview-scenarios.mjs --json < pr-body.txt # prints the raw declaration as JSON

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEFAULT_SCENARIOS_CSV = 'demo';

const SCENARIOS_PATTERN = /<!--\s*preview-scenarios:\s*(.*?)\s*-->/is;
const NOT_APPLICABLE_PATTERN = /<!--\s*preview-scenario:\s*not-applicable:\s*(.*?)\s*-->/is;

/**
 * Parses a PR body for a preview scenario declaration.
 * Returns one of:
 *   { kind: 'scenarios', names: string[] }
 *   { kind: 'not-applicable', reason: string }
 *   { kind: 'empty' }   — the tag is present but names are empty
 *   { kind: 'unset' }   — no declaration found at all
 */
export function parsePreviewScenarioDeclaration(body) {
  const text = body ?? '';

  const notApplicable = text.match(NOT_APPLICABLE_PATTERN);
  if (notApplicable) {
    const reason = notApplicable[1].trim();
    return reason.length > 0
      ? { kind: 'not-applicable', reason }
      : { kind: 'not-applicable', reason: '' };
  }

  const scenarios = text.match(SCENARIOS_PATTERN);
  if (scenarios) {
    const names = scenarios[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return names.length > 0 ? { kind: 'scenarios', names } : { kind: 'empty' };
  }

  return { kind: 'unset' };
}

/**
 * Resolves a declaration to the scenario CSV to pass as
 * PREVIEW_SEED_SCENARIOS. Every preview still needs *some* seeded starting
 * point, so "not-applicable"/"unset"/"empty" all fall back to the "demo"
 * baseline — not-applicable only exempts a PR from having to justify new
 * scenario coverage (see docs/preview-scenarios.md), it doesn't mean the
 * preview should be unseeded.
 */
export function resolveBuildScenarios(declaration) {
  if (declaration.kind === 'scenarios') {
    return declaration.names.join(',');
  }
  return DEFAULT_SCENARIOS_CSV;
}

function main() {
  const asJson = process.argv.includes('--json');
  const body = readFileSync(0, 'utf8');
  const declaration = parsePreviewScenarioDeclaration(body);
  console.log(asJson ? JSON.stringify(declaration) : resolveBuildScenarios(declaration));
}

const isCliInvocation = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCliInvocation) {
  main();
}
