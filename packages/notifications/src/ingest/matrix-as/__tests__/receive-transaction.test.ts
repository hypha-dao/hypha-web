import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../dedupe', () => ({ claimProcessedEvent: vi.fn() }));
vi.mock('../resolve-room-to-space', () => ({ resolveRoomToSpace: vi.fn() }));

import { claimProcessedEvent } from '../dedupe';
import { resolveRoomToSpace } from '../resolve-room-to-space';
import { receiveTransaction } from '../receive-transaction';
import type { MatrixEvent, RoomSpaceContext } from '../types';

const claimMock = vi.mocked(claimProcessedEvent);
const resolveMock = vi.mocked(resolveRoomToSpace);

const SPACE_CTX: RoomSpaceContext = {
  kind: 'space',
  spaceId: 7,
  spaceSlug: 'acme',
};

const db = {} as never;

function msg(overrides: Partial<MatrixEvent> = {}): MatrixEvent {
  return {
    type: 'm.room.message',
    event_id: '$e1',
    room_id: '!room:hs',
    sender: '@alice:hs',
    origin_server_ts: 1_700_000_000_000,
    content: { msgtype: 'm.text', body: 'hi' },
    ...overrides,
  };
}

function run(
  events: MatrixEvent[],
  dispatch = vi.fn().mockResolvedValue(undefined),
  txnId = 'txn-1',
) {
  return receiveTransaction(
    { txnId, body: { events } },
    { db, dispatch, botUserIds: ['@hypha_bot:hs'] },
  ).then((result) => ({ result, dispatch }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveMock.mockResolvedValue(SPACE_CTX);
  claimMock.mockResolvedValue(true);
});

describe('receiveTransaction', () => {
  it('dispatches a plain message as chat.message exactly once', async () => {
    const { result, dispatch } = await run([msg()]);

    expect(result).toMatchObject({ dispatched: 1, duplicates: 0, ignored: 0 });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'chat.message',
        source: { kind: 'matrix', matrixEventId: '$e1' },
        actor: { matrixUserId: '@alice:hs' },
        context: SPACE_CTX,
        payload: expect.objectContaining({
          body: 'hi',
          mentionedMatrixUserIds: [],
          occurredAt: 1_700_000_000_000,
        }),
      }),
    );
  });

  it('classifies a message with mentions for others as chat.mention', async () => {
    const { dispatch } = await run([
      msg({
        content: {
          msgtype: 'm.text',
          body: 'hey',
          ['m.mentions']: { user_ids: ['@bob:hs', '@alice:hs'] },
        },
      }),
    ]);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'chat.mention',
        payload: expect.objectContaining({
          // sender stripped out of the mention list
          mentionedMatrixUserIds: ['@bob:hs'],
        }),
      }),
    );
  });

  it('treats a self-mention-only message as chat.message', async () => {
    const { dispatch } = await run([
      msg({
        content: {
          msgtype: 'm.text',
          body: 'note to self',
          ['m.mentions']: { user_ids: ['@alice:hs'] },
        },
      }),
    ]);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'chat.message' }),
    );
  });

  it('ignores messages sent by a suppressed bot MXID (no claim, no dispatch)', async () => {
    const { result, dispatch } = await run([msg({ sender: '@hypha_bot:hs' })]);
    expect(result).toMatchObject({ dispatched: 0, ignored: 1 });
    expect(claimMock).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('ignores non-message events', async () => {
    const { result, dispatch } = await run([
      { ...msg(), type: 'm.room.member' },
      { ...msg(), type: 'm.reaction' },
    ]);
    expect(result).toMatchObject({ dispatched: 0, ignored: 2 });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('records an unmapped room as processed but does not dispatch', async () => {
    resolveMock.mockResolvedValue(null);
    const { result, dispatch } = await run([msg()]);

    expect(result).toMatchObject({ dispatched: 0, ignored: 1 });
    expect(dispatch).not.toHaveBeenCalled();
    expect(claimMock).toHaveBeenCalledWith(
      expect.objectContaining({
        matrixEventId: '$e1',
        eventType: 'm.room.message#unmapped',
      }),
      db,
    );
  });

  it('treats a lost claim race as a duplicate — no dispatch', async () => {
    claimMock.mockResolvedValue(false);
    const { result, dispatch } = await run([msg()]);
    expect(result).toMatchObject({ dispatched: 0, duplicates: 1 });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('deduplicates the same event across two different txnIds', async () => {
    claimMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const first = await receiveTransaction(
      { txnId: 'txn-A', body: { events: [msg()] } },
      { db, dispatch, botUserIds: [] },
    );
    const second = await receiveTransaction(
      { txnId: 'txn-B', body: { events: [msg()] } },
      { db, dispatch, botUserIds: [] },
    );

    expect(first.dispatched).toBe(1);
    expect(second).toMatchObject({ dispatched: 0, duplicates: 1 });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('propagates a durable-write failure (crash-before-ack → route returns 5xx)', async () => {
    claimMock.mockRejectedValue(new Error('db unavailable'));
    await expect(
      receiveTransaction(
        { txnId: 't', body: { events: [msg()] } },
        { db, dispatch: vi.fn(), botUserIds: [] },
      ),
    ).rejects.toThrow('db unavailable');
  });

  it('swallows a dispatch() failure (at-most-once) and still resolves', async () => {
    const dispatch = vi.fn().mockRejectedValue(new Error('dispatch boom'));
    const { result } = await run([msg()], dispatch);
    expect(result).toMatchObject({ dispatched: 0, dispatchFailures: 1 });
  });

  it('aggregates counts across a mixed batch', async () => {
    resolveMock.mockResolvedValue(SPACE_CTX);
    claimMock.mockImplementation(
      async (entry) => entry.matrixEventId !== '$dup',
    );

    const { result, dispatch } = await run([
      msg({ event_id: '$a' }), // dispatched
      msg({ event_id: '$dup' }), // claim returns false -> duplicate
      { ...msg({ event_id: '$b' }), type: 'm.room.member' }, // ignored (not a message)
      msg({ event_id: '$c', sender: '@hypha_bot:hs' }), // ignored (bot)
    ]);

    expect(result).toEqual({
      dispatched: 1,
      dispatchFailures: 0,
      duplicates: 1,
      ignored: 2,
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
