import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForwardEmailProvider } from './email-provider';

describe('ForwardEmailProvider', () => {
  it('reports unconfigured when the API key is missing', () => {
    const provider = new ForwardEmailProvider({ apiKey: '' });
    assert.equal(provider.isConfigured(), false);
  });

  it('posts form-encoded mail with Basic auth when configured', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = new ForwardEmailProvider({
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

    const result = await provider.send({
      to: 'hello@singletonsd.com',
      from: 'noreply@example.com',
      replyTo: 'jane@acme.com',
      subject: 'Hello',
      text: 'Body',
      correlationId: 'corr-1',
    });

    assert.equal(result.accepted, true);
    assert.equal(result.providerMessageId, 'fe-123');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, 'https://api.example.test/v1/emails');
    const headers = new Headers(calls[0]?.init.headers);
    assert.equal(
      headers.get('Authorization'),
      `Basic ${Buffer.from('test-token:').toString('base64')}`,
    );
    assert.equal(headers.get('X-Correlation-Id'), 'corr-1');
    const body = String(calls[0]?.init.body);
    assert.match(body, /replyTo=jane%40acme.com/);
    assert.match(body, /to=hello%40singletonsd.com/);
  });
});
