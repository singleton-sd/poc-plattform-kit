import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertValidStaticWebAppConfig,
  findDuplicateSwaRoutes,
  normalizeSwaRoute,
} from './validate-staticwebapp-config.mjs';

test('normalizeSwaRoute strips trailing slashes except root', () => {
  assert.equal(normalizeSwaRoute('/'), '/');
  assert.equal(normalizeSwaRoute('/admin'), '/admin');
  assert.equal(normalizeSwaRoute('/admin/'), '/admin');
  assert.equal(normalizeSwaRoute('/admin///'), '/admin');
});

test('findDuplicateSwaRoutes detects /admin vs /admin/', () => {
  const duplicates = findDuplicateSwaRoutes([
    { route: '/admin', rewrite: '/admin/index.html' },
    { route: '/admin/', rewrite: '/admin/index.html' },
  ]);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0]?.normalized, '/admin');
});

test('assertValidStaticWebAppConfig accepts unique routes', () => {
  assert.doesNotThrow(() =>
    assertValidStaticWebAppConfig(
      {
        routes: [
          { route: '/admin', rewrite: '/admin/index.html' },
          { route: '/privacy', rewrite: '/privacy.html' },
        ],
      },
      'fixture',
    ),
  );
});

test('assertValidStaticWebAppConfig rejects trailing-slash duplicates', () => {
  assert.throws(
    () =>
      assertValidStaticWebAppConfig(
        {
          routes: [
            { route: '/admin', rewrite: '/admin/index.html' },
            { route: '/admin/', rewrite: '/admin/index.html' },
          ],
        },
        'fixture.json',
      ),
    /fixture\.json: Azure SWA rejects duplicate routes/,
  );
});
