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
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, '.skills', 'manifest.json');
const profilePath = path.join(root, '.skills', 'profile');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  fail(`Missing ${manifestPath}`);
}

const manifest = readJson(manifestPath);
const source = manifest.sourceUrl || manifest.source || 'singleton-sd/ai-plattform-skills';
const agents =
  Array.isArray(manifest.agents) && manifest.agents.length
    ? manifest.agents
    : ['cursor', 'claude-code', 'grok', 'codex'];
const skills = Array.isArray(manifest.skills) ? manifest.skills : [];
const useCopy = manifest.copy !== false;
const pin = process.argv.includes('--pin');

if (skills.length === 0) {
  fail('manifest.skills is empty');
}

const agentArgs = agents.flatMap((a) => ['-a', a]);
const skillArgs = skills.flatMap((s) => ['--skill', s]);
const args = [
  'skills',
  'add',
  source,
  ...skillArgs,
  ...agentArgs,
  ...(useCopy ? ['--copy'] : []),
  '-y',
];

console.log(`[skills:install] source=${source}`);
console.log(`[skills:install] ref=${manifest.ref || '(default branch)'}`);
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

Installed from \`${source}\` (ref: \`${manifest.ref || 'default'}\`).
Agents: ${agents.join(', ')}.

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
}
