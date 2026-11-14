import assert from 'node:assert/strict';
import test from 'node:test';
import { serverFieldsToErrors } from './bind-lead-form.mjs';

test('server field paths map onto brochure copy', () => {
  const errors = serverFieldsToErrors(['email', 'consent', 'turnstileToken', 'unknown']);
  assert.equal(errors.email, 'Enter a valid email address.');
  assert.equal(errors.consent, 'Please accept the privacy notice.');
  assert.equal(errors.turnstileToken, 'Complete the security check.');
  assert.equal(errors.unknown, undefined);
});
