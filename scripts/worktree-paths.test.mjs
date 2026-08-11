import assert from 'node:assert/strict';
import path from 'node:path';
import {
  branchName,
  folderName,
  mainRepoFromGitCommonDir,
  workspaceRootFromRepo,
  worktreePath,
} from './worktree-paths.mjs';

const repoRoot = path.join('C:', '00Personal', 'singleton-sd', 'plattform-kit', 'repo');

assert.equal(folderName('86d3zc5af', 'permission-gating'), '86d3zc5af-permission-gating');
assert.equal(
  branchName({ taskId: '86d3zc5af', slug: 'permission-gating' }),
  'feature/86d3zc5af-permission-gating',
);
assert.equal(
  branchName({ taskId: '86d3zc5af', slug: 'permission-gating', hotfix: true }),
  'hotfix/86d3zc5af-permission-gating',
);

assert.equal(mainRepoFromGitCommonDir(path.join(repoRoot, '.git')), path.resolve(repoRoot));
assert.throws(() => mainRepoFromGitCommonDir(repoRoot), /\.git/);

assert.equal(
  workspaceRootFromRepo(repoRoot),
  path.join('C:', '00Personal', 'singleton-sd', 'plattform-kit'),
);
assert.equal(
  worktreePath({ repoRoot, taskId: '86d3zc5af', slug: 'permission-gating' }),
  path.join(
    'C:',
    '00Personal',
    'singleton-sd',
    'plattform-kit',
    'worktrees',
    '86d3zc5af-permission-gating',
  ),
);

assert.throws(() => branchName({ taskId: 'SSDOP-42', slug: 'dark-mode' }), /ClickUp/i);
assert.throws(() => branchName({ taskId: '86d3zc5af', slug: 'Feature/Nope' }), /kebab/i);
assert.throws(
  () => branchName({ taskId: '86d3zc5af', slug: 'feature-permission-gating' }),
  /prefix/i,
);
assert.throws(() => folderName('86d3zc5af', ''), /slug/i);

console.log('worktree-paths.test.mjs: ok');
