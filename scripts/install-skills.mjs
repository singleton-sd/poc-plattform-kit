#!/usr/bin/env node
/**
 * Install curated skills from ai-plattform-skills (GitHub mirror by default)
 * into multi-agent project folders via the Skills CLI.
 *
 * Usage:
 *   node scripts/install-skills.mjs
 *   node scripts/install-skills.mjs --pin
 *
 * Requires network. Prefer --copy for Windows/cloud. Manifest: .skills/manifest.json
 *
 * Pin mode resolves an immutable-ish source URL using manifest.ref (branch, tag, or
 * commit SHA). Prefer a commit SHA in manifest.ref for fully reproducible installs.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, '.skills', 'manifest.json');
const profilePath = path.join(root, '.skills', 'profile');

/** Default Skills CLI package version (pin for reproducibility). */
const DEFAULT_SKILLS_CLI = 'skills@1.5.23';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

/**
 * Build a Skills CLI source that includes an explicit git ref when possible.
 * Supported forms: owner/repo shorthand, https://github.com/owner/repo,
 * or https://github.com/owner/repo/tree/<ref>.
 */
function resolveSource(manifest, { requireRef }) {
  const ref = typeof manifest.ref === 'string' ? manifest.ref.trim() : '';
  if (requireRef && !ref) {
    fail('manifest.ref is required for --pin (use a branch, tag, or commit SHA)');
  }

  const sourceUrl = manifest.sourceUrl || '';
  const source = manifest.source || 'singleton-sd/ai-plattform-skills';

  if (!ref) {
    return sourceUrl || source;
  }

  // Already a tree/blob URL with path — append nothing if ref already embedded.
  if (/\/tree\/[^/]+/.test(sourceUrl)) {
    return sourceUrl;
  }

  if (sourceUrl.includes('github.com')) {
    const base = sourceUrl.replace(/\.git$/, '').replace(/\/$/, '');
    return `${base}/tree/${encodeURIComponent(ref)}`;
  }

  // GitHub shorthand → tree URL
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source)) {
    return `https://github.com/${source}/tree/${encodeURIComponent(ref)}`;
  }

  // Fallback: append #ref for git URLs that accept it
  return `${sourceUrl || source}#${ref}`;
}

if (!fs.existsSync(manifestPath)) {
  fail(`Missing ${manifestPath}`);
}

const manifest = readJson(manifestPath);
const pin = process.argv.includes('--pin');
const resolvedSource = resolveSource(manifest, { requireRef: pin });
const agents =
  Array.isArray(manifest.agents) && manifest.agents.length
    ? manifest.agents
    : ['cursor', 'claude-code', 'grok', 'codex'];
const skills = Array.isArray(manifest.skills) ? manifest.skills : [];
const useCopy = manifest.copy !== false;
const skillsCli = manifest.skillsCli || DEFAULT_SKILLS_CLI;

if (skills.length === 0) {
  fail('manifest.skills is empty');
}

const agentArgs = agents.flatMap((a) => ['-a', a]);
const skillArgs = skills.flatMap((s) => ['--skill', s]);
const args = [
  '--yes',
  skillsCli,
  'add',
  resolvedSource,
  ...skillArgs,
  ...agentArgs,
  ...(useCopy ? ['--copy'] : []),
  '-y',
];

console.log(`[skills:install] source=${resolvedSource}`);
console.log(`[skills:install] ref=${manifest.ref || '(default)'}`);
console.log(`[skills:install] cli=${skillsCli}`);
console.log(`[skills:install] pin=${pin}`);
console.log(`[skills:install] agents=${agents.join(',')}`);
console.log(`[skills:install] skills=${skills.length}`);
console.log(`[skills:install] npx ${args.join(' ')}`);

const result = spawnSync('npx', args, {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if (result.status !== 0) {
  fail(`npx skills add failed with exit ${result.status}`);
}

const profileNote = fs.existsSync(profilePath)
  ? fs.readFileSync(profilePath, 'utf8')
  : JSON.stringify({ engineeringHost: 'github' }, null, 2);

const profileMd = `# Skills profile (generated)

Installed from \`${resolvedSource}\` (ref: \`${manifest.ref || 'default'}\`).
CLI: \`${skillsCli}\`. Agents: ${agents.join(', ')}.

\`\`\`json
${profileNote.trim()}
\`\`\`

Engineering host decides GitHub vs GitLab issues. ClickUp is product/tracking only.
`;

const agentsDir = path.join(root, '.agents', 'skills');
fs.mkdirSync(agentsDir, { recursive: true });
fs.writeFileSync(path.join(agentsDir, 'PROFILE.md'), profileMd, 'utf8');

console.log(`[skills:install] wrote .agents/skills/PROFILE.md`);
if (pin) {
  console.log(
    '[skills:install] pin mode: commit .agents/skills, .claude/skills, .grok/skills as needed',
  );
  console.log('[skills:install] tip: set manifest.ref to a commit SHA for fully immutable pins');
}
