import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isGeneratedOnly,
  isWebPreviewRelevant,
  shouldRunWebPreview,
} from './should-run-web-preview.mjs';

test('isWebPreviewRelevant matches preview-web path globs', () => {
  assert.equal(isWebPreviewRelevant('apps/web/src/app/page.tsx'), true);
  assert.equal(isWebPreviewRelevant('packages/forms/src/index.ts'), true);
  assert.equal(isWebPreviewRelevant('.github/workflows/preview-web.yml'), true);
  assert.equal(isWebPreviewRelevant('scripts/entra-spa-preview-redirect.sh'), true);
  assert.equal(isWebPreviewRelevant('pillars/permissions/src/permissions.controller.ts'), false);
  assert.equal(isWebPreviewRelevant('apps/api/src/main.ts'), false);
});

test('isGeneratedOnly matches OpenAPI and Orval output only', () => {
  assert.equal(isGeneratedOnly('packages/api-client/openapi.json'), true);
  assert.equal(
    isGeneratedOnly('packages/api-client/src/generated/permissions/permissions.ts'),
    true,
  );
  assert.equal(isGeneratedOnly('packages/api-client/src/custom-fetch.ts'), false);
  assert.equal(isGeneratedOnly('packages/api-client/package.json'), false);
});

test('PR #165 shaped: generated + pillars → skip SWA', () => {
  assert.equal(
    shouldRunWebPreview([
      'packages/api-client/openapi.json',
      'packages/api-client/src/generated/models/grantPermissionDto.ts',
      'packages/api-client/src/generated/permissions/permissions.ts',
      'pillars/permissions/src/permissions.controller.ts',
      'pillars/permissions/src/permissions.controller.spec.ts',
    ]),
    false,
  );
});

test('apps/web + generated → run SWA', () => {
  assert.equal(
    shouldRunWebPreview([
      'apps/web/src/app/page.tsx',
      'packages/api-client/openapi.json',
      'packages/api-client/src/generated/models/index.ts',
    ]),
    true,
  );
});

test('hand-written api-client only → run SWA', () => {
  assert.equal(shouldRunWebPreview(['packages/api-client/src/custom-fetch.ts']), true);
});

test('only generated openapi/orval → skip SWA', () => {
  assert.equal(
    shouldRunWebPreview([
      'packages/api-client/openapi.json',
      'packages/api-client/src/generated/models/index.ts',
    ]),
    false,
  );
});

test('non-generated package → run SWA', () => {
  assert.equal(shouldRunWebPreview(['packages/forms/src/index.ts']), true);
});

test('empty or irrelevant-only → skip SWA', () => {
  assert.equal(shouldRunWebPreview([]), false);
  assert.equal(shouldRunWebPreview(['docs/pr-pipelines.md']), false);
});
