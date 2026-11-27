import { describe, expect, it, vi, type Mock } from 'vitest';
import type { CreatedSignal } from '@hypha-platform/core/server';
import { buildToolLogLine } from '../log';
import { ERRORS } from '../descriptions';
import { caller, connect, makeDeps } from './harness';

const ZERO_WIDTH = String.fromCodePoint(0x200b);

const created = (over: Partial<CreatedSignal> = {}): CreatedSignal => ({
  id: 99,
  spaceId: 5,
  slug: 'coh-abcd1234',
  spaceSlug: 'alpha',
  type: 'Need',
  title: 'Water',
  description: 'The well is dry. See https://evil.example/x',
  tags: ['water', `ur${ZERO_WIDTH}gent`],
  createdAt: '2026-11-27T10:00:00.000Z',
  duplicate: false,
  origin: { kind: 'mcp_client', clientLabel: 'Example AI' },
  ...over,
});

const args = {
  spaceSlug: 'alpha',
  type: 'Need',
  title: 'Water',
  description: 'The well is dry.',
  tags: ['water'],
};

type Response = {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
};

async function call(
  deps: ReturnType<typeof makeDeps>['deps'],
  input: Record<string, unknown> = args,
): Promise<Response> {
  const { client, close } = await connect(deps);
  try {
    return (await client.callTool({
      name: 'hypha_create_signal',
      arguments: input,
    })) as Response;
  } finally {
    await close();
  }
}

/** Loosely typed on purpose: tests swap in failures, which the success type would reject. */
const enabled = (
  createSignal: Mock = vi.fn(async () => ({
    ok: true as const,
    data: created(),
  })),
) => {
  const made = makeDeps({ writesEnabled: true }, { createSignal });
  return { ...made, createSignal };
};

describe('hypha_create_signal', () => {
  it('is not listed while writes are off', async () => {
    for (const over of [{}, { writesEnabled: false }]) {
      const { deps } = makeDeps(over);
      const { client, close } = await connect(deps);
      const names = (await client.listTools()).tools.map((t) => t.name);
      await close();
      expect(names).not.toContain('hypha_create_signal');
    }
  });

  it('is listed last, as a closed-world, non-destructive write, while writes are on', async () => {
    const { deps } = enabled();
    const { client, close } = await connect(deps);
    const { tools } = await client.listTools();
    await close();
    expect(tools.at(-1)?.name).toBe('hypha_create_signal');
    expect(tools.at(-1)?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
  });

  it('passes the arguments and the caller to the feature, and returns the presented signal', async () => {
    const { deps, createSignal } = enabled();
    const r = await call(deps);
    expect(r.isError).toBeFalsy();
    expect(createSignal).toHaveBeenCalledWith(args, caller);
    expect(r.structuredContent).toEqual({
      slug: 'coh-abcd1234',
      url: 'https://app.example/en/dho/alpha/coherence?signal=coh-abcd1234',
      spaceSlug: 'alpha',
      type: 'Need',
      tags: ['water', 'urgent'],
      createdAt: '2026-11-27T10:00:00.000Z',
      duplicate: false,
      origin: { kind: 'mcp_client', clientName: 'Example AI' },
      userText: {
        title: 'Water',
        description: expect.not.stringContaining('https://evil.example'),
        truncated: [],
      },
    });
    // No internal ids reach the model.
    expect(JSON.stringify(r.structuredContent)).not.toMatch(/"(id|spaceId)"/);
  });

  it('a duplicate is reported as such', async () => {
    const { deps } = enabled(
      vi.fn(async () => ({
        ok: true as const,
        data: created({ duplicate: true }),
      })),
    );
    expect((await call(deps)).structuredContent).toMatchObject({
      duplicate: true,
    });
  });

  it('rejects input outside the limits before the feature runs', async () => {
    const { deps, createSignal } = enabled();
    for (const bad of [
      { ...args, title: 'x'.repeat(51) },
      { ...args, description: '' },
      { ...args, type: 'Trend' },
      { ...args, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) },
      { ...args, tags: ['x'.repeat(41)] },
      { ...args, spaceSlug: '../alpha' },
    ]) {
      const r = await call(deps, bad);
      expect(r.isError).toBe(true);
    }
    expect(createSignal).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: 'forbidden' }, ERRORS.writeNotAllowed],
    [{ code: 'not_found' }, ERRORS.notFound],
    [{ code: 'invalid_input', message: 'x' }, ERRORS.invalidInput],
    [{ code: 'access_check_failed' }, ERRORS.unavailable],
    [
      { code: 'rate_limited', retryAfterSeconds: 42 },
      `${ERRORS.writeRateLimited} Try again in 42 seconds.`,
    ],
  ])('maps the refusal %o to its text', async (failure, text) => {
    const { deps } = enabled(
      vi.fn(async () => ({ ok: false as const, ...failure } as never)),
    );
    const r = await call(deps);
    expect(r).toMatchObject({ isError: true, content: [{ text }] });
  });

  it('writes one audit line with ids only', async () => {
    const { deps, logs } = enabled();
    await call(deps);
    expect(logs).toHaveLength(1);
    const line = buildToolLogLine(logs[0]!);
    expect(line).toEqual({
      event: 'mcp.write',
      tool: 'hypha_create_signal',
      outcome: 'ok',
      durationMs: expect.any(Number),
      clientId: null,
      personId: 1,
      spaceId: 5,
      signalId: 99,
      duplicate: false,
    });
    const text = JSON.stringify(line);
    for (const s of ['Water', 'well', 'alpha', 'Example AI', '0xabc']) {
      expect(text).not.toContain(s);
    }
  });

  it('a refused call still gets its audit line, with the outcome', async () => {
    const { deps, logs } = enabled(
      vi.fn(async () => ({ ok: false as const, code: 'forbidden' } as never)),
    );
    await call(deps);
    expect(buildToolLogLine(logs[0]!)).toMatchObject({
      event: 'mcp.write',
      outcome: 'forbidden',
      personId: 1,
    });
  });

  it('a caller that could not be resolved is refused, and logged without a person', async () => {
    const createSignal = vi.fn();
    const { deps, logs } = makeDeps(
      {
        writesEnabled: true,
        access: {
          kind: 'refused',
          refusal: { code: 'no_profile', message: 'No profile' },
        },
      },
      { createSignal },
    );
    const r = await call(deps);
    expect(r.isError).toBe(true);
    expect(createSignal).not.toHaveBeenCalled();
    const line = buildToolLogLine(logs[0]!);
    expect(line).toMatchObject({ event: 'mcp.write', outcome: 'no_profile' });
    expect(line).not.toHaveProperty('personId');
  });

  it('a write past the deadline: outcome unknown to the model, the late result still audited', async () => {
    let finishWrite: (value: unknown) => void = () => {};
    const slow = vi.fn(
      () =>
        new Promise((resolve) => {
          finishWrite = resolve;
        }),
    );
    const kept: Promise<unknown>[] = [];
    const { deps, logs } = makeDeps(
      {
        writesEnabled: true,
        deadlineMs: 20,
        keepAlive: (work) => kept.push(work),
      },
      { createSignal: slow as never },
    );
    const r = await call(deps);
    expect(r).toMatchObject({
      isError: true,
      content: [{ text: ERRORS.writeTimeout }],
    });
    expect(buildToolLogLine(logs[0]!)).toMatchObject({
      event: 'mcp.write',
      outcome: 'timeout',
      personId: 1,
    });
    expect(kept).toHaveLength(1);

    finishWrite({ ok: true, data: created() });
    await kept[0];
    expect(logs).toHaveLength(2);
    expect(buildToolLogLine(logs[1]!)).toMatchObject({
      event: 'mcp.write',
      outcome: 'late_ok',
      personId: 1,
      spaceId: 5,
      signalId: 99,
    });
  });
});
