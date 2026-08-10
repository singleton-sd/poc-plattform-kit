import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { contactCorsHeaders, submitContactInquiry, validateContactInquiry } from '../contact';

export async function contactHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin');
  const cors = contactCorsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: cors };
  }

  try {
    const body = await request.json().catch(() => null);
    const validated = validateContactInquiry(body);
    if (!validated.ok) {
      return {
        status: validated.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
        jsonBody: { error: validated.error },
      };
    }

    const result = await submitContactInquiry(validated.value);
    return {
      status: 202,
      headers: { ...cors, 'Content-Type': 'application/json' },
      jsonBody: result,
    };
  } catch (error) {
    context.error('contact failed', error);
    const message = error instanceof Error ? error.message : 'contact failed';
    const unavailable =
      /not configured|FORWARDEMAIL|CONTACT_INBOX|CONTACT_FROM/i.test(message) ||
      /Forward Email send failed/i.test(message);
    return {
      status: unavailable ? 503 : 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
      jsonBody: {
        error: unavailable
          ? 'Contact delivery is temporarily unavailable. Please try again later.'
          : 'We could not send your message. Please try again shortly.',
      },
    };
  }
}

app.http('contact', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'contact',
  handler: contactHandler,
});
