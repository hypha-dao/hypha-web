import { describe, expect, it, vi } from 'vitest';
import {
  V2_RESPONSE_HEADERS,
  applyV2Headers,
  withV2Headers,
} from '../response-headers';

const expectV2Headers = (response: Response) => {
  expect(response.headers.get('Cache-Control')).toBe(
    V2_RESPONSE_HEADERS['Cache-Control'],
  );
  expect(response.headers.get('Vary')).toBe(V2_RESPONSE_HEADERS.Vary);
};

describe('withV2Headers: every response class carries the v2 headers', () => {
  const unhandled = () => new Response('{}', { status: 500 });

  it.each([200, 204, 400, 401, 403, 404, 502, 500])(
    'status %i from the handler',
    async (status) => {
      const handler = withV2Headers(
        async () => new Response(status === 204 ? null : '{}', { status }),
        unhandled,
      );
      const response = await handler();
      expect(response.status).toBe(status);
      expectV2Headers(response);
    },
  );

  it('replaces a looser Cache-Control set by the handler', async () => {
    const handler = withV2Headers(
      async () =>
        new Response('{}', {
          headers: { 'Cache-Control': 'public, max-age=600', Vary: '*' },
        }),
      unhandled,
    );
    expectV2Headers(await handler());
  });

  it('answers an exception that escaped the handler with a 500 that has the headers', async () => {
    const onUnhandled = vi.fn(() => new Response('{}', { status: 500 }));
    const handler = withV2Headers(async () => {
      throw new Error('boom');
    }, onUnhandled);
    const response = await handler();
    expect(response.status).toBe(500);
    expect(onUnhandled).toHaveBeenCalledOnce();
    expectV2Headers(response);
  });

  it('applyV2Headers works on a bare response', () => {
    expectV2Headers(applyV2Headers(new Response('{}')));
  });
});
