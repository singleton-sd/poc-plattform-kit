import assert from 'node:assert/strict';
import test from 'node:test';
import { foldSubjectIntoMessage, serverFieldsToErrors } from './bind-lead-form.mjs';
import { LEAD_MESSAGE_MAX } from './lead-config.mjs';

test('server field paths map onto brochure copy', () => {
  const errors = serverFieldsToErrors(['email', 'consent', 'turnstileToken', 'unknown']);
  assert.equal(errors.email, 'Enter a valid email address.');
  assert.equal(errors.consent, 'Please accept the privacy notice.');
  assert.equal(errors.turnstileToken, 'Complete the security check.');
  assert.equal(errors.unknown, undefined);
});

test('subject prefix plus a max-length message exceeds the schema cap', () => {
  const composed = foldSubjectIntoMessage('Sales / demo request', 'm'.repeat(LEAD_MESSAGE_MAX));
  assert.ok(composed.length > LEAD_MESSAGE_MAX);
  const reserved = foldSubjectIntoMessage(
    'Sales / demo request',
    'm'.repeat(LEAD_MESSAGE_MAX - '[Sales / demo request]\n\n'.length),
  );
  assert.equal(reserved.length, LEAD_MESSAGE_MAX);
});
