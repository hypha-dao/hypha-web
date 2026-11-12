import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, type HttpError } from '../fetch-json';

const mockFetch = (response: Response) => {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fn);
  return fn;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchJson', () => {
  it('returns the parsed body on 200 and forwards input and init', async () => {
    const fn = mockFetch(Response.json({ voters: [1] }));
    const init = { headers: { Accept: 'application/json' } };

    await expect(fetchJson('/api/x', init)).resolves.toEqual({ voters: [1] });
    expect(fn).toHaveBeenCalledWith('/api/x', init);
  });

  it('returns a null body on 200 unchanged', async () => {
    mockFetch(Response.json(null));
    await expect(fetchJson('/api/x')).resolves.toBeNull();
  });

  it('throws an error carrying the status on 404', async () => {
    mockFetch(
      new Response(JSON.stringify({ error: 'nope' }), {
        status: 404,
        statusText: 'Not Found',
      }),
    );

    const error = (await fetchJson('/api/x', undefined, 'voters').catch(
      (e) => e,
    )) as HttpError;
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(404);
    expect(error.message).toBe('Failed to fetch voters: Not Found');
  });

  it('throws an error carrying the status on 500', async () => {
    mockFetch(new Response('{"error":"boom"}', { status: 500 }));

    const error = (await fetchJson('/api/x').catch((e) => e)) as HttpError;
    expect(error.status).toBe(500);
  });

  it('does not throw an HttpError for a non-JSON error page (status wins)', async () => {
    mockFetch(new Response('<html>Bad gateway</html>', { status: 502 }));

    const error = (await fetchJson('/api/x').catch((e) => e)) as HttpError;
    expect(error.status).toBe(502);
  });

  it('rejects when a 200 body is not JSON', async () => {
    mockFetch(new Response('<html>ok?</html>', { status: 200 }));

    const error = (await fetchJson('/api/x').catch(
      (e) => e,
    )) as Partial<HttpError>;
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBeUndefined();
  });
});
