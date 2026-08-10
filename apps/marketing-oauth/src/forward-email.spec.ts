import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForwardEmailClient } from './forward-email';

describe('ForwardEmailClient', () => {
  it('reports unconfigured without an API key', () => {
    assert.equal(new ForwardEmailClient({ apiKey: '' }).isConfigured(), false);
  });

  it('posts form-encoded mail with Basic auth', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new ForwardEmailClient({
      apiKey: 'test-token',
      baseUrl: 'https://api.example.test',
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init: init ?? {} });
        return new Response(JSON.stringify({ id: 'fe-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    const result = await client.send({
      to: 'hello@singletonsd.com',
      from: 'noreply@example.com',
      replyTo: 'jane@acme.com',
      subject: 'Hello',
      text: 'Body',
    });

    assert.equal(result.providerMessageId, 'fe-123');
    assert.equal(calls[0]?.url, 'https://api.example.test/v1/emails');
    const headers = new Headers(calls[0]?.init.headers);
    assert.equal(
      headers.get('Authorization'),
      `Basic ${Buffer.from('test-token:').toString('base64')}`,
    );
  });
});
