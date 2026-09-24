import { describe, expect, it, vi } from 'vitest';

vi.mock('../dedupe', () => ({ claimProcessedEvent: vi.fn() }));
vi.mock('../resolve-room-to-space', () => ({ resolveRoomToSpace: vi.fn() }));

import { claimProcessedEvent } from '../dedupe';
import { resolveRoomToSpace } from '../resolve-room-to-space';
import { ingestParsedMessage } from '../ingest-message';
import type { ParsedMessageEvent } from '../types';

const NOW = Date.parse('2026-09-24T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function parsed(ageMs: number): ParsedMessageEvent {
  return {
    matrixEventId: '$evt',
    roomId: '!room:hs',
    senderMxid: '@alice:hs',
    body: 'hello',
    mentionedMatrixUserIds: [],
    occurredAt: NOW - ageMs,
  };
}

function deps(overrides: Record<string, unknown> = {}) {
  const dispatch = vi.fn().mockResolvedValue(undefined);
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return {
    dispatch,
    logger,
    deps: {
      db: {} as never,
      dispatch,
      botUserIds: new Set<string>(),
      logger,
      now: () => NOW,
      maxEventAgeMs: 24 * HOUR,
      ...overrides,
    },
  };
}

describe('ingestParsedMessage age guard', () => {
  it('skips a stale event without touching the ledger, the room lookup or dispatch', async () => {
    vi.clearAllMocks();
    const { dispatch, deps: d } = deps();

    await expect(ingestParsedMessage(parsed(25 * HOUR), {}, d)).resolves.toBe(
      'ignored_stale',
    );

    expect(claimProcessedEvent).not.toHaveBeenCalled();
    expect(resolveRoomToSpace).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('still processes an event inside the window', async () => {
    vi.clearAllMocks();
    vi.mocked(resolveRoomToSpace).mockResolvedValue({
      kind: 'space',
      spaceId: 1,
      spaceSlug: 'acme',
    } as never);
    vi.mocked(claimProcessedEvent).mockResolvedValue(true);
    const { dispatch, deps: d } = deps();

    await expect(ingestParsedMessage(parsed(2 * HOUR), {}, d)).resolves.toBe(
      'dispatched',
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('honours a custom maximum age', async () => {
    vi.clearAllMocks();
    const { deps: d } = deps({ maxEventAgeMs: 30 * 60 * 1000 });
    await expect(ingestParsedMessage(parsed(HOUR), {}, d)).resolves.toBe(
      'ignored_stale',
    );
  });
});
