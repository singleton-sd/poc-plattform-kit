import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../.github/workflows/preview-api.yml', import.meta.url);

test('API previews migrate the database before deploying the image', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const migrationStep = workflow.indexOf('- name: Apply database migrations');
  const deployStep = workflow.indexOf('- name: Deploy ephemeral Container App');

  assert.notEqual(migrationStep, -1, 'database migration step is missing');
  assert.notEqual(deployStep, -1, 'Container App deployment step is missing');
  assert.ok(migrationStep < deployStep, 'database migrations must run before deployment');

  const migrationScript = workflow.slice(migrationStep, deployStep);
  assert.match(migrationScript, /--name database-url/);
  assert.match(migrationScript, /::add-mask::\$DATABASE_URL/);
  assert.match(migrationScript, /prisma@5\.22\.0 migrate deploy/);
  assert.match(migrationScript, /packages\/db\/prisma\/schema\.prisma/);
});
