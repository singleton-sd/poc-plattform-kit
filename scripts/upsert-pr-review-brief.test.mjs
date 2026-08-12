import assert from 'node:assert/strict';
import {
  BRIEF_MARKER,
  findBriefComment,
  formatBrief,
  nextAction,
  previewUrlsFromSources,
} from './upsert-pr-review-brief.mjs';

assert.equal(
  nextAction({
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    labels: [],
    requiredCiState: 'green',
    unresolvedThreads: 0,
  }),
  'READY FOR HUMAN',
);
assert.equal(
  nextAction({
    mergeable: 'CONFLICTING',
    mergeStateStatus: 'DIRTY',
    labels: ['needs-rebase'],
    requiredCiState: 'green',
    unresolvedThreads: 0,
  }),
  'waiting on merge conflicts',
);
assert.equal(
  nextAction({
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    labels: ['ci-failed'],
    requiredCiState: 'red',
    unresolvedThreads: 0,
  }),
  'waiting on CI',
);
assert.equal(
  nextAction({
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    labels: ['has-feedback', 'preview-blocked'],
    requiredCiState: 'green',
    unresolvedThreads: 1,
  }),
  'agent fixing comments',
);

const body = formatBrief({
  title: 'Cut PR hygiene noise and add Human Review Brief',
  ticketTitle: 'Cut PR hygiene noise and add Human Review Brief',
  prUrl: 'https://github.com/singleton-sd/poc-plattform-kit/pull/999',
  summary: '- Stop hygiene comments\n- Keep labels',
  localCommands: ['node scripts/pr-handoff-gate.test.mjs'],
  checks: [
    { name: 'Lint / format / build (web)', conclusion: 'SUCCESS', link: 'https://example/ci' },
  ],
  previewUrls: ['https://example.preview'],
  threads: [{ author: 'Copilot', path: 'scripts/foo.mjs', excerpt: 'Use a factory' }],
  labels: ['preview-blocked'],
  infraNotes: ['SWA Free staging quota'],
  nextAction: 'READY FOR HUMAN',
});

assert.match(body, new RegExp(BRIEF_MARKER));
assert.match(body, /Human Review Brief/);
assert.match(body, /Stop hygiene comments/);
assert.match(body, /Lint \/ format \/ build \(web\): \*\*SUCCESS\*\*/);
assert.match(body, /https:\/\/example\.preview/);
assert.match(body, /Copilot on `scripts\/foo.mjs`/);
assert.match(body, /preview-blocked/);
assert.match(body, /Chromatic visual-accept is human-only/);
assert.match(body, /\*\*READY FOR HUMAN\*\*/);

const again = formatBrief({
  title: 'Same',
  summary: 'x',
  checks: [],
  previewUrls: [],
  threads: [],
  labels: [],
  nextAction: 'waiting on CI',
});
assert.equal((again.match(new RegExp(BRIEF_MARKER, 'g')) ?? []).length, 1);

const comments = [
  { id: 1, body: '<!-- swa-preview-web --> https://preview.example/' },
  { id: 2, body: `${BRIEF_MARKER}\n## Human Review Brief` },
];
assert.deepEqual(
  previewUrlsFromSources(
    [
      'Test plan: https://not-a-preview.example/',
      '<!-- swa-preview-marketing --> https://marketing-preview.example/',
      '<!-- api-preview-aca --> https://api-preview.example/',
    ].join('\n'),
    comments,
  ),
  [
    'https://api-preview.example/',
    'https://marketing-preview.example/',
    'https://preview.example/',
  ],
);
assert.equal(findBriefComment(comments)?.id, 2);

console.log('upsert-pr-review-brief tests passed');
