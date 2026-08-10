import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pinGeneratorOutput } from './pin-generator-output.mjs';

test('pinGeneratorOutput inserts an output line when none exists', () => {
  const schema = 'generator client {\n  provider = "prisma-client-js"\n}\n';
  const pinned = pinGeneratorOutput(schema, '../node_modules/.prisma/client');
  assert.match(pinned, /output\s*=\s*"\.\.\/node_modules\/\.prisma\/client"/);
});

test('pinGeneratorOutput replaces an existing output line', () => {
  const schema =
    'generator client {\n  provider = "prisma-client-js"\n  output   = "./generated/preview-client"\n}\n';
  const pinned = pinGeneratorOutput(schema, '../node_modules/.prisma/client');
  assert.match(pinned, /output\s*=\s*"\.\.\/node_modules\/\.prisma\/client"/);
  assert.doesNotMatch(pinned, /generated\/preview-client/);
});

test('pinGeneratorOutput throws when no generator block is present', () => {
  assert.throws(() => pinGeneratorOutput('datasource db {}\n', './out'), /generator block/);
});
