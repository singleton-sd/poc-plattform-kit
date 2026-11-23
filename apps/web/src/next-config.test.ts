import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const webRoot = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(webRoot, 'package.json'), 'utf8')) as {
  version: string;
};

function loadNextPublicAppVersion(version: string | undefined): string {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (version === undefined) {
    delete env.NEXT_PUBLIC_APP_VERSION;
  } else {
    env.NEXT_PUBLIC_APP_VERSION = version;
  }

  const configHref = pathToFileURL(join(webRoot, 'next.config.mjs')).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import config from ${JSON.stringify(configHref)}; process.stdout.write(JSON.stringify(config.env.NEXT_PUBLIC_APP_VERSION));`,
    ],
    { env, encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `exit ${result.status}`).trim());
  }

  return JSON.parse(result.stdout) as string;
}

describe('next.config NEXT_PUBLIC_APP_VERSION', () => {
  it('uses a non-empty environment value', () => {
    expect(loadNextPublicAppVersion('9.9.9-release')).toBe('9.9.9-release');
  });

  it('falls back to package.json version when the variable is unset', () => {
    expect(loadNextPublicAppVersion(undefined)).toBe(pkg.version);
  });

  it('falls back to package.json version when the variable is empty', () => {
    expect(loadNextPublicAppVersion('')).toBe(pkg.version);
  });
});
