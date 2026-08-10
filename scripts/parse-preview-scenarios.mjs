#!/usr/bin/env node
// Extracts a PR's declared preview scenario selection from its body.
// See docs/preview-scenarios.md and AGENTS.md for the full delivery
// requirement; this script only implements the parsing convention:
//
//   Preview scenarios: pillar/tenant/settings, pillar/x/y
//   Preview scenarios: not-applicable — <reason>
//
// A plain, visible line rather than an HTML comment: it's easier for a
// human reviewer to spot at a glance, and doesn't depend on trusting that
// whatever tool opened or edited the PR preserved a hidden comment
// verbatim (some PR-editing tools in this repo's agent workflow have been
// observed not to round-trip `<!-- ... -->` content reliably when reading
// a PR body back, even though the underlying GitHub payload does contain
// it).
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

// Matches a line like "Preview scenarios: ..." or "Preview-scenarios: ...",
// case-insensitive, anywhere in the body.
const DECLARATION_LINE_PATTERN = /^[ \t]*preview[ -]scenarios?[ \t]*:[ \t]*(.+?)[ \t]*$/im;
const NOT_APPLICABLE_PATTERN = /^not-applicable\b\s*[:\-–—]?\s*(.*)$/i;

/**
 * Parses a PR body for a preview scenario declaration.
 * Returns one of:
 *   { kind: 'scenarios', names: string[] }
 *   { kind: 'not-applicable', reason: string }
 *   { kind: 'empty' }   — the marker is present but names/reason are empty
 *   { kind: 'unset' }   — no declaration found at all
 */
// Strips HTML comments before matching so instructional example text inside
// a template's <!-- ... --> block (e.g. the scaffolded
// ".github/pull_request_template.md" instructions, which themselves show
// "Preview scenarios: pillar/tenant/settings, pillar/x/y" as an example) is
// never mistaken for the author's actual visible declaration.
function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

export function parsePreviewScenarioDeclaration(body) {
  const text = stripHtmlComments(body ?? '');
  const match = text.match(DECLARATION_LINE_PATTERN);
  if (!match) {
    return { kind: 'unset' };
  }

  const value = match[1].trim();
  const notApplicable = value.match(NOT_APPLICABLE_PATTERN);
  if (notApplicable) {
    const reason = notApplicable[1].trim();
    return { kind: 'not-applicable', reason };
  }

  const names = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return names.length > 0 ? { kind: 'scenarios', names } : { kind: 'empty' };
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
