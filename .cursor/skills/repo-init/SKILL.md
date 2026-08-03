---
name: Repo Init
description: Initialize a new repository with Singleton SD's full git conventions tooling stack
tags: [engineering, git, conventions, setup, husky, commitlint, release-it]
audience: [engineers, tech-leads]
status: stable
---

# Repo Init

You are a senior engineer setting up a new Singleton SD repository. Follow these steps in order to install and wire up the full git conventions stack: **husky**, **commitlint** (with custom ticket-number rule), and **release-it** with conventional changelog.

## Before starting, confirm

- **Ticket prefix** — what is the project's ticket prefix? (e.g. `SSDOP`, `PROJ`, `INF`)
- **GitLab project path** — e.g. `singleton-sd/my-repo`
- **Package manager** — `yarn` (default) or `npm`
- **TypeScript project?** — yes/no (hooks are written in TypeScript; ts-node is required for them)

---

## Step 1 — Install dependencies

```bash
yarn add -D \
  husky@^9 \
  @commitlint/cli@^19 \
  @commitlint/config-conventional@^19 \
  release-it@^18 \
  @release-it/conventional-changelog@^10 \
  ts-node@^10 \
  typescript
```

---

## Step 2 — Initialize husky

```bash
npx husky init
```

This creates the `.husky/` directory and adds a `prepare` script to `package.json`. Verify `package.json` has:

```json
"scripts": {
  "prepare": "husky"
}
```

---

## Step 3 — Add release scripts to package.json

Add to the `scripts` block in `package.json`:

```json
"release": "release-it -VV --dry-run",
"release:ci": "release-it --ci"
```

---

## Step 4 — Create .commitlintrc.js

Create `.commitlintrc.js` at the repo root. Replace `TICKET_PREFIX` with the confirmed prefix (e.g. `SSDOP`):

```js
const { execSync } = require('child_process');

const getGitBranch = async () => {
  try {
    const branchName = await execSync('git symbolic-ref --short HEAD').toString().trim();
    return branchName;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const getTicketNumberFromBranch = (branchName) => {
  const ticketNumberRegex = /feature\/(\w+-\d{1,5})/;
  const match = branchName.match(ticketNumberRegex);
  return match ? match[1] : null;
};

const getTicketNumberFromCommit = (commitMessage) => {
  const ticketNumberRegex = /:\s*([A-Z]{1,5}-\d{1,5})/;
  const match = commitMessage.match(ticketNumberRegex);
  return match ? match[1] : null;
};

module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'ticket-number': async ({ header }) => {
          if (header.includes('Release')) {
            console.info('Skipping ticket number as this is a release commit');
            return [true];
          }
          const branchName = (await getGitBranch()) || '';
          const ticketNumberFromBranch = getTicketNumberFromBranch(branchName);
          const ticketNumberFromCommit = getTicketNumberFromCommit(header);

          if (ticketNumberFromCommit) {
            if (ticketNumberFromBranch && ticketNumberFromCommit !== ticketNumberFromBranch) {
              return [
                false,
                `The ticket number in the commit message (${ticketNumberFromCommit}) does not match the ticket number in the branch name (${ticketNumberFromBranch}). Please update either the commit message or the branch name to match.`,
              ];
            }
            return [true];
          }

          if (ticketNumberFromBranch) {
            return [true];
          }

          return [
            false,
            'Commit message does not include a ticket number, and no ticket number was found in the branch name. Please provide a valid ticket number in the commit message or update the branch name.',
          ];
        },
      },
    },
  ],
  rules: {
    'ticket-number': [2, 'always'],
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 72],
    'subject-max-length': [2, 'always', 50],
    'subject-case': [2, 'always', 'sentence-case'],
    'subject-full-stop': [2, 'never'],
  },
};
```

---

## Step 5 — Create .release-it.json

Create `.release-it.json` at the repo root. Replace `GITLAB_PROJECT_PATH` with the confirmed path:

```json
{
  "$schema": "https://unpkg.com/release-it/schema/release-it.json",
  "gitlab": {
    "release": true
  },
  "git": {
    "commitMessage": "chore: Release v${version}\n\n[skip ci]",
    "requireCleanWorkingDir": true,
    "commit": true,
    "push": true,
    "tag": true
  },
  "npm": {
    "publish": false
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "infile": "CHANGELOG.md",
      "preset": {
        "name": "conventionalcommits",
        "compareUrlFormat": "{{host}}/{{owner}}/{{repository}}/compare/{{currentTag}}..{{previousTag}}"
      }
    }
  }
}
```

> Set `"npm": { "publish": true }` if this repo publishes to npm.

---

## Step 6 — Create husky helper: .husky/husky-use-node.sh

```sh
#!/bin/sh

# Load Node from .nvmrc if possible
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use > /dev/null
  npm install -g yarn
else
  echo "⚠️  NVM not found. Falling back to system Node version."
fi
```

---

## Step 7 — Create husky hooks

### .husky/commit-msg

```sh
. "$(dirname "$0")/husky-use-node.sh"

if [ ! -f ".husky/tsconfig-node.json" ]; then echo '{"compilerOptions":{"esModuleInterop":true}}' > .husky/tsconfig-node.json; fi

yarn ts-node --project .husky/tsconfig-node.json .husky/prepare-commit-msg.ts "$1" "$2"

yarn commitlint --edit
```

### .husky/pre-commit

```sh
. "$(dirname "$0")/husky-use-node.sh"

if [ ! -f ".husky/tsconfig-node.json" ]; then echo '{"compilerOptions":{"esModuleInterop":true}}' > .husky/tsconfig-node.json; fi

yarn ts-node --project .husky/tsconfig-node.json .husky/check-filenames.ts
```

### .husky/post-checkout

```sh
. "$(dirname "$0")/husky-use-node.sh"

if [ ! -f ".husky/tsconfig-node.json" ]; then echo '{"compilerOptions":{"esModuleInterop":true}}' > .husky/tsconfig-node.json; fi

BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
PREVIOUS_BRANCH=$(git rev-parse --symbolic-full-name --abbrev-ref=loose @{-1})

if [ -z "$PREVIOUS_BRANCH" ]; then
    PREVIOUS_BRANCH="main"
    echo "⚠️ Unable to determine the previous branch. Falling back to '$PREVIOUS_BRANCH'."
fi

VALIDATION_CMD="yarn ts-node --project .husky/tsconfig-node.json .husky/check-branch.ts"

set +e
OUTPUT=$($VALIDATION_CMD 2>&1)
VALID=$?
set -e

if [ $VALID -ne 0 ]; then
    echo "⚠️  Invalid branch name: '$BRANCH_NAME'. Rolling back to the previous branch: '$PREVIOUS_BRANCH'."

    if git checkout "$PREVIOUS_BRANCH"; then
        echo "✅ Successfully switched back to '$PREVIOUS_BRANCH'."
    else
        echo "❌ Failed to switch back to the previous branch. Please handle it manually."
        exit 1
    fi

    if git branch -D "$BRANCH_NAME"; then
        echo "✅ Successfully deleted the invalid branch: '$BRANCH_NAME'."
    else
        echo "❌ Failed to delete the branch: '$BRANCH_NAME'. Please delete it manually."
    fi

    exit 1
else
    echo "✅ Branch name validation passed for: '$BRANCH_NAME'."
fi
```

---

## Step 8 — Create TypeScript hook scripts

### .husky/prepare-commit-msg.ts

```ts
import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

const commitMessageFilePath = process.argv[2];

const getGitBranch = async () => {
  try {
    const branchName = await execSync('git symbolic-ref --short HEAD').toString().trim();
    return branchName;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const getTicketNumberFromCommit = (commitMessage: string) => {
  const ticketNumberRegex = /:\s*([A-Z]{1,5}-\d{1,5})/;
  const match = commitMessage.match(ticketNumberRegex);
  return match ? match[1] : null;
};

const extractTicketNumberFromBranch = (branchName: string) => {
  const ticketNumberRegex = /feature|hotfix\/(\w+-\d{1,5})/;
  const match = branchName.match(ticketNumberRegex);
  return match ? match[1] : null;
};

const addTicketNumberToCommitMessage = async (commitMessage: string) => {
  const branchName = await getGitBranch();
  const ticketNumber = extractTicketNumberFromBranch(branchName);

  if (ticketNumber) {
    const modifiedCommitMessage = commitMessage.replace(/^(.*):\s*/, '$1: ' + ticketNumber + ' ');
    writeFileSync(commitMessageFilePath, modifiedCommitMessage, 'utf-8');
  }
};

const processCommitMessage = async () => {
  console.log('Checking ticket number on commit message');
  try {
    const commitMessage = readFileSync(commitMessageFilePath, 'utf-8');

    if (commitMessage.includes('Release')) {
      console.info('Skipping ticket number as this is a release commit');
      return;
    }

    if (!getTicketNumberFromCommit(commitMessage)) {
      await addTicketNumberToCommitMessage(commitMessage);
    }
  } catch (error) {
    const err = error as Error;
    console.error('An error occurred:', err.message);
    process.exit(1);
  }
};

processCommitMessage();
```

### .husky/check-branch.ts

```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';

const branchName = getCurrentBranchName();

const isValidBranchName =
  branchName === 'master' ||
  branchName === 'main' ||
  branchName === 'design' ||
  branchName === 'develop' ||
  /^release\/v\d+\.\d+\.\d+$/.test(branchName) ||
  /^(feature|hotfix)\/(\w+-\d{1,5})(-\w+)*$/.test(branchName);

if (!isValidBranchName) {
  console.error(
    'Error: Branch name must be one of: main, master, develop, design, ' +
    'feature/{TICKET}, hotfix/{TICKET}, or release/vX.Y.Z',
  );
  process.exit(1);
}

function getCurrentBranchName() {
  const headPath = resolve('.git', 'HEAD');
  const headContent = readFileSync(headPath, 'utf-8').trim();
  const branchMatch = headContent.match(/^ref: refs\/heads\/(.+)$/);

  if (branchMatch && branchMatch[1]) {
    return branchMatch[1];
  } else {
    console.error('Error: Unable to determine the current branch.');
    process.exit(1);
  }
}
```

### .husky/check-filenames.ts

```ts
import { execSync } from 'child_process';

// Allows: kebab-case.ts, kebab-case.spec.ts, PascalCase.ts, PascalCase.d.ts, etc.
const allowedPattern = /^([a-z0-9-]+|[A-Z][a-zA-Z0-9]+)(\.spec|\.test)?(\.d)?(\.defs)?\.tsx?$/;

const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', {
  encoding: 'utf-8',
})
  .split('\n')
  .filter((file) => file.trim() !== '')
  .filter((file) => file.endsWith('.ts'));

const invalidFiles = stagedFiles.filter((file) => {
  if (!file) return false;
  const fileName = file.split('/').pop();
  return fileName && !allowedPattern.test(fileName.trim());
});

if (invalidFiles.length > 0) {
  console.error(
    `❌ The following files do not match the naming convention (kebab-case.ts or PascalCase.ts):\n${invalidFiles.join('\n')}`,
  );
  process.exit(1);
}

console.log('✅ All staged files follow the naming convention.');
```

---

## Step 9 — Make shell hooks executable

```bash
chmod +x .husky/commit-msg .husky/pre-commit .husky/post-checkout .husky/husky-use-node.sh
```

---

## Step 10 — Add .gitattributes for consistent line endings

Create `.gitattributes` at the repo root:

```
* text=auto

.husky/* text eol=lf
*.sh text eol=lf
package.json text eol=lf
```

---

## Step 11 — Verify the setup

```bash
# Test commitlint
echo "feat: TICKET-1 Test commit" | yarn commitlint

# Test that a bad commit fails
echo "feat: missing ticket" | yarn commitlint
# Expected: error about missing ticket number

# Dry-run a release
yarn release
```

---

## Step 12 — (Optional) GitLab CI integration

If deploying to GitLab, create `.gitlab-ci.yml`:

```yaml
image: 'node:22-alpine'

# Include the shared pipeline from singleton-sd/pipelines/npm
include:
  - project: 'singletonsd/pipelines/npm'
    file: '/src/.gitlab-ci-main.yml'

variables:
  GLOBAL_IMAGE_NAME: 'node'
  GLOBAL_IMAGE_TAG: '22-alpine'
  ORIGINAL_REPOSITORY: 'GITLAB_PROJECT_PATH'   # ← replace
  ENABLE_RELEASE_JOB: 'true'
  ENABLE_RELEASE_PUBLISH: 'true'             # set 'false' if not publishing to npm
  NODE_COMMON_RELEASE_TRIGGER_PIPELINE: 'true'

stages:
  - install
  - test_static
  - test_dynamic
  - build
  - deploy
  - release
  - package
```

---

## Known issues & adaptations

### ESM projects (`"type": "module"` in package.json)

Two things break when the repo is an ESM package:

**1. `.commitlintrc.js` uses CommonJS `module.exports` — it will fail**

Use `.commitlintrc.cjs` instead. Node.js honours the `.cjs` extension regardless of `"type": "module"`.

**2. Hook scripts as `.ts` files fail with `Unknown file extension ".ts"`**

`ts-node` is invoked by Node's ESM loader, which doesn't understand `.ts`. Fix: write hook scripts as `.mjs` (native ESM) instead of `.ts`, removing the `ts-node` dependency from the hooks entirely. The logic is identical — just use `import`/`export` syntax without type annotations.

Update the shell hooks to call `node .husky/script.mjs` directly:

```sh
node .husky/prepare-commit-msg.mjs "$1"
node ./node_modules/@commitlint/cli/cli.js --edit "$1"
```

---

### Windows (Git Bash) — `yarn <binary>` path mangling

`yarn ts-node` and similar commands fail in Git Bash on Windows because the resolved binary path (`C:\path\to\.bin\ts-node`) gets mangled when passed through the shell. Fix: call binaries via their full `node_modules` path using `node`:

```sh
# Instead of: yarn ts-node --project ...
node ./node_modules/ts-node/dist/bin.js --project ...

# Instead of: yarn commitlint --edit
node ./node_modules/@commitlint/cli/cli.js --edit "$1"
```

---

### `*.lock` in `.gitignore` blocks `yarn.lock`

If the repo's `.gitignore` includes `*.lock`, add an exception so the lockfile is committed:

```gitignore
*.lock
!yarn.lock
```

---

### Windows (PowerShell) — UTF-8 BOM breaks JSON in CI

PowerShell `Set-Content -Encoding utf8` and `Out-File -Encoding utf8` write a **UTF-8 BOM** (`EF BB BF`) on Windows. That breaks `package.json` parsing in `release-it` and other Node JSON loaders:

```text
ERROR Unexpected token '﻿', "﻿{ "name"... is not valid JSON
```

**Do not** scaffold `package.json`, `.release-it.json`, or other JSON/MJS source files with PowerShell UTF-8 encoding.

Prefer:

- The editor Write tool or `git show` from a known-good template repo
- UTF-8 **without** BOM:

```powershell
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
```

Before the first push, verify `package.json` starts with `{` (byte `123`), not BOM bytes `239 187 191`.

---

## Files created summary

```
.commitlintrc.js
.release-it.json
.gitattributes
.husky/
├── husky-use-node.sh
├── commit-msg
├── pre-commit
├── post-checkout
├── prepare-commit-msg.ts
├── check-branch.ts
└── check-filenames.ts
```

`package.json` additions:
- `"prepare": "husky"` in scripts
- `"release": "release-it -VV --dry-run"` in scripts
- `"release:ci": "release-it --ci"` in scripts
