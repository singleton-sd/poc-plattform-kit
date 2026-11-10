import assert from 'node:assert/strict';
import test from 'node:test';
import { rehypePrefixBase } from './rehype-prefix-base.mjs';

test('rehypePrefixBase prefixes markdown /privacy under a preview base', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'a',
            properties: { href: '/privacy' },
            children: [{ type: 'text', value: 'Privacy Policy' }],
          },
        ],
      },
    ],
  };
  rehypePrefixBase({ base: '/pr-preview/pr-12/' })(tree);
  const anchor = tree.children[0].children[0];
  assert.equal(anchor.properties.href, '/pr-preview/pr-12/privacy');
});

test('rehypePrefixBase leaves production root-relative links unchanged', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'a',
        properties: { href: '/privacy' },
        children: [],
      },
    ],
  };
  rehypePrefixBase({ base: '/' })(tree);
  assert.equal(tree.children[0].properties.href, '/privacy');
});

test('rehypePrefixBase ignores absolute URLs', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'a',
        properties: { href: 'https://app.plattform-kit.poc.singletonsd.com' },
        children: [],
      },
    ],
  };
  rehypePrefixBase({ base: '/pr-preview/pr-12/' })(tree);
  assert.equal(tree.children[0].properties.href, 'https://app.plattform-kit.poc.singletonsd.com');
});
