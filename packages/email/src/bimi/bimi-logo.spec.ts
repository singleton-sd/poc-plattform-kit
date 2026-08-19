import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BIMI_LOGO_SVG } from './bimi-logo';

describe('BIMI_LOGO_SVG', () => {
  it('looks like Tiny-PS SVG (required attributes + title)', () => {
    assert.match(BIMI_LOGO_SVG, /baseProfile="tiny-ps"/);
    assert.match(BIMI_LOGO_SVG, /version="1\.2"/);
    assert.match(BIMI_LOGO_SVG, /preserveAspectRatio="xMidYMid meet"/);
    assert.match(BIMI_LOGO_SVG, /<title>[\s\S]*<\/title>/);
  });

  it('is square (same width/height)', () => {
    const width = BIMI_LOGO_SVG.match(/width="(\d+)"/)?.[1];
    const height = BIMI_LOGO_SVG.match(/height="(\d+)"/)?.[1];
    assert.ok(width, 'missing width');
    assert.ok(height, 'missing height');
    assert.equal(width, height);
  });

  it('does not contain risky/forbidden constructs', () => {
    assert.equal(BIMI_LOGO_SVG.includes('<script'), false);
    assert.equal(BIMI_LOGO_SVG.includes('onload='), false);
    assert.equal(BIMI_LOGO_SVG.includes('xlink:href'), false);
    assert.equal(BIMI_LOGO_SVG.includes('<image'), false);
  });
});
