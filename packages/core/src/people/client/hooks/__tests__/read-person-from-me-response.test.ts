import { describe, expect, it } from 'vitest';
import { readPersonFromMeResponse } from '../read-person-from-me-response';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('readPersonFromMeResponse', () => {
  it('returns null for 404 so new Privy users can reach signup', async () => {
    const person = await readPersonFromMeResponse(
      jsonResponse(404, { error: 'User not found' }),
    );
    expect(person).toBeNull();
  });

  it('throws on 500 so error JSON is not cached as a Person', async () => {
    await expect(
      readPersonFromMeResponse(
        jsonResponse(500, { error: 'Internal Server Error' }),
      ),
    ).rejects.toThrow('Failed to fetch profile: 500');
  });

  it('throws on 401', async () => {
    await expect(
      readPersonFromMeResponse(jsonResponse(401, { error: 'Unauthorized' })),
    ).rejects.toThrow('Failed to fetch profile: 401');
  });

  it('returns the profile JSON on 200', async () => {
    const person = await readPersonFromMeResponse(
      jsonResponse(200, { id: 1, slug: 'ada', name: 'Ada' }),
    );
    expect(person).toMatchObject({ id: 1, slug: 'ada', name: 'Ada' });
  });
});
