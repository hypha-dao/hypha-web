import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BATCH_WINDOW_MS,
  MAX_BATCH_SLUGS,
  fetchProposalVoters,
} from '../batch-proposal-voters';

const voter = (id: number) => ({
  id,
  name: `n${id}`,
  avatarUrl: '',
  vote: 'yes' as const,
  address: `0x${id}`,
});

const ok = (voters: Record<string, unknown[]>, failed: string[] = []) =>
  Response.json({ voters, failed });

const urlsOf = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.map((call) => String(call[0]));

const flush = () => vi.advanceTimersByTimeAsync(BATCH_WINDOW_MS);

describe('fetchProposalVoters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends one request for slugs requested in the same window and fans out', async () => {
    const fn = vi.fn().mockResolvedValue(ok({ a: [voter(1)], b: [], c: [] }));
    vi.stubGlobal('fetch', fn);

    const results = Promise.all([
      fetchProposalVoters('a'),
      fetchProposalVoters('b'),
      fetchProposalVoters('c'),
    ]);
    expect(fn).not.toHaveBeenCalled();
    await flush();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(urlsOf(fn)[0]).toBe('/api/v1/proposal-voters?slugs=a,b,c');
    expect(await results).toEqual([[voter(1)], [], []]);
  });

  it('shares one entry when the same slug is requested twice', async () => {
    const fn = vi.fn().mockResolvedValue(ok({ a: [voter(1)] }));
    vi.stubGlobal('fetch', fn);

    const results = Promise.all([
      fetchProposalVoters('a'),
      fetchProposalVoters('a'),
    ]);
    await flush();

    expect(urlsOf(fn)).toEqual(['/api/v1/proposal-voters?slugs=a']);
    expect(await results).toEqual([[voter(1)], [voter(1)]]);
  });

  it('starts a new request for a request after the window', async () => {
    const fn = vi.fn().mockImplementation(async () => ok({ a: [], b: [] }));
    vi.stubGlobal('fetch', fn);

    const first = fetchProposalVoters('a');
    await flush();
    await first;
    const second = fetchProposalVoters('b');
    await flush();
    await second;

    expect(urlsOf(fn)).toEqual([
      '/api/v1/proposal-voters?slugs=a',
      '/api/v1/proposal-voters?slugs=b',
    ]);
  });

  it('encodes slugs', async () => {
    const fn = vi.fn().mockResolvedValue(ok({ 'a b': [] }));
    vi.stubGlobal('fetch', fn);
    const result = fetchProposalVoters('a b');
    await flush();
    await result;
    expect(urlsOf(fn)[0]).toBe('/api/v1/proposal-voters?slugs=a%20b');
  });

  it('splits more than the cap into several requests', async () => {
    const fn = vi.fn().mockImplementation(async (url: string) => {
      const slugs = new URL(url, 'http://x').searchParams
        .get('slugs')!
        .split(',');
      return ok(Object.fromEntries(slugs.map((s) => [s, []])));
    });
    vi.stubGlobal('fetch', fn);

    const slugs = Array.from(
      { length: MAX_BATCH_SLUGS + 1 },
      (_, i) => `s${i}`,
    );
    const results = Promise.all(slugs.map((s) => fetchProposalVoters(s)));
    await flush();
    await results;

    expect(fn).toHaveBeenCalledTimes(2);
    const sizes = urlsOf(fn).map(
      (u) =>
        new URL(u, 'http://x').searchParams.get('slugs')!.split(',').length,
    );
    expect(sizes).toEqual([MAX_BATCH_SLUGS, 1]);
  });

  it('rejects only the slug the server left out, with a 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ a: [voter(1)] })));
    const a = fetchProposalVoters('a');
    const gone = fetchProposalVoters('gone');
    const goneResult = gone.catch((e) => e);
    await flush();

    expect(await a).toEqual([voter(1)]);
    expect((await goneResult).status).toBe(404);
  });

  it('rejects an inherited property name like a missing slug, not resolving a function', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ a: [voter(1)] })));
    const a = fetchProposalVoters('a');
    const ctor = fetchProposalVoters('constructor').catch((e) => e);
    await flush();

    expect(await a).toEqual([voter(1)]);
    expect((await ctor).status).toBe(404);
  });

  it('rejects only a slug whose chain read failed, with a retryable 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(ok({ a: [voter(1)] }, ['b'])),
    );
    const a = fetchProposalVoters('a');
    const b = fetchProposalVoters('b').catch((e) => e);
    await flush();

    expect(await a).toEqual([voter(1)]);
    expect((await b).status).toBe(502);
  });

  it('rejects every slug in the request on an HTTP error, keeping the status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 500 })),
    );
    const a = fetchProposalVoters('a').catch((e) => e);
    const b = fetchProposalVoters('b').catch((e) => e);
    await flush();

    expect((await a).status).toBe(500);
    expect((await b).status).toBe(500);
  });

  it('a failed chunk does not fail the other chunk', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockImplementationOnce(async () => ok({ last: [voter(9)] }));
    vi.stubGlobal('fetch', fn);

    const slugs = Array.from({ length: MAX_BATCH_SLUGS }, (_, i) => `s${i}`);
    const firstChunk = slugs.map((s) => fetchProposalVoters(s).catch((e) => e));
    const last = fetchProposalVoters('last');
    await flush();

    expect((await firstChunk[0]).status).toBe(500);
    expect(await last).toEqual([voter(9)]);
  });
});
