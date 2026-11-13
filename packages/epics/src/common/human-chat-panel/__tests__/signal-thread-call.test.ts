import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { HYPHA_ROOM_TYPES } from '../../../../../core/src/matrix/room-types';
import {
  assertSignalCallRoom,
  planSignalThreadCall as planSignalThreadCallWithType,
  runSignalThreadCallPlan,
  showSignalCallToolbar,
  signalCallChromeAllowed,
  SignalThreadCallAborted,
  takeCoherenceRoomCreate,
  type SignalThreadCallPlan,
} from '../signal-thread-call';

function planSignalThreadCall(
  input: Omit<
    Parameters<typeof planSignalThreadCallWithType>[0],
    'ownedRoomType'
  >,
): SignalThreadCallPlan {
  return planSignalThreadCallWithType({
    ownedRoomType: HYPHA_ROOM_TYPES.signal,
    ...input,
  });
}

const panelSource = readFileSync(
  resolve(__dirname, '../../human-right-panel.tsx'),
  'utf8',
);

describe('planSignalThreadCall', () => {
  it('refuses anything that is not this signal thread', () => {
    expect(
      planSignalThreadCall({
        isSignalThread: false,
        signalSlug: 'need-water',
        coherenceRoomId: '!signal:hs',
      }),
    ).toEqual({ action: 'refuse', reason: 'not-signal' });
    expect(
      planSignalThreadCall({
        isSignalThread: true,
        signalSlug: '   ',
        coherenceRoomId: '!signal:hs',
      }),
    ).toEqual({ action: 'refuse', reason: 'not-signal' });
  });

  it('does not refuse an empty discussion; it ensures the signal room', () => {
    expect(
      planSignalThreadCall({
        isSignalThread: true,
        signalSlug: 'need-water',
        coherenceRoomId: null,
      }),
    ).toEqual({ action: 'ensure-then-start' });
  });

  it('starts the persisted signal room even when another room is live', () => {
    expect(
      planSignalThreadCall({
        isSignalThread: true,
        signalSlug: 'need-water',
        coherenceRoomId: '!signal:hs',
        coherenceRoomType: HYPHA_ROOM_TYPES.signal,
        spaceRoomId: '!space:hs',
        directRoomId: '!dm:hs',
      }),
    ).toEqual({ action: 'start', roomId: '!signal:hs' });
  });

  it('ensures again when the stored room is the space room, a DM, or another Hypha type', () => {
    expect(
      planSignalThreadCall({
        isSignalThread: true,
        signalSlug: 'need-water',
        coherenceRoomId: '!space:hs',
        spaceRoomId: '!space:hs',
      }).action,
    ).toBe('ensure-then-start');
    expect(
      planSignalThreadCall({
        isSignalThread: true,
        signalSlug: 'need-water',
        coherenceRoomId: '!dm:hs',
        directRoomId: '!dm:hs',
        coherenceRoomType: HYPHA_ROOM_TYPES.dm,
      }).action,
    ).toBe('ensure-then-start');
    expect(
      planSignalThreadCall({
        isSignalThread: true,
        signalSlug: 'need-water',
        coherenceRoomId: '!proposal:hs',
        coherenceRoomType: HYPHA_ROOM_TYPES.proposal,
      }).action,
    ).toBe('ensure-then-start');
    expect(
      planSignalThreadCall({
        isSignalThread: true,
        signalSlug: 'need-water',
        coherenceRoomId: '!legacy:hs',
        coherenceRoomType: null,
        spaceRoomId: '!space:hs',
      }),
    ).toEqual({ action: 'start', roomId: '!legacy:hs' });
  });
});

describe('assertSignalCallRoom', () => {
  it('rejects a space room, a DM, another signal room, and an empty id', () => {
    expect(() =>
      assertSignalCallRoom({
        roomId: '!space:hs',
        spaceRoomId: '!space:hs',
      }),
    ).toThrow(/space room/);
    expect(() =>
      assertSignalCallRoom({
        roomId: '!dm:hs',
        directRoomId: '!dm:hs',
      }),
    ).toThrow(/direct room/);
    expect(() =>
      assertSignalCallRoom({
        roomId: '!other:hs',
        otherSignalRoomIds: ['!other:hs'],
      }),
    ).toThrow(/another signal/);
    expect(() => assertSignalCallRoom({ roomId: '  ' })).toThrow(/requires/);
    expect(
      assertSignalCallRoom({
        roomId: ' !signal:hs ',
        spaceRoomId: '!space:hs',
        directRoomId: '!dm:hs',
        otherSignalRoomIds: ['!other:hs'],
      }),
    ).toBe('!signal:hs');
  });
});

describe('takeCoherenceRoomCreate', () => {
  it('creates once for simultaneous callers and caches the room', async () => {
    const cache = new Map<string, string>();
    const inFlight = new Map<string, Promise<{ roomId: string }>>();
    let creates = 0;
    const create = () => {
      creates += 1;
      return Promise.resolve({ roomId: '!signal:hs' });
    };
    const [first, second] = await Promise.all([
      takeCoherenceRoomCreate(cache, inFlight, 'need-water', create),
      takeCoherenceRoomCreate(cache, inFlight, 'need-water', create),
    ]);
    expect(creates).toBe(1);
    expect(first.roomId).toBe('!signal:hs');
    expect(second.roomId).toBe('!signal:hs');
    expect(inFlight.size).toBe(0);
    await takeCoherenceRoomCreate(cache, inFlight, 'need-water', create);
    expect(creates).toBe(1);
  });

  it('does not cache a failed create, so a later attempt can retry', async () => {
    const cache = new Map<string, string>();
    const inFlight = new Map<string, Promise<{ roomId: string }>>();
    await expect(
      takeCoherenceRoomCreate(cache, inFlight, 'need-water', () =>
        Promise.reject(new Error('matrix down')),
      ),
    ).rejects.toThrow(/matrix down/);
    expect(cache.size).toBe(0);
    expect(inFlight.size).toBe(0);
    const created = await takeCoherenceRoomCreate(
      cache,
      inFlight,
      'need-water',
      () => Promise.resolve({ roomId: '!signal:hs' }),
    );
    expect(created.roomId).toBe('!signal:hs');
  });

  it('keeps two signals on two creates', async () => {
    const cache = new Map<string, string>();
    const inFlight = new Map<string, Promise<{ roomId: string }>>();
    const rooms = await Promise.all([
      takeCoherenceRoomCreate(cache, inFlight, 'need-water', () =>
        Promise.resolve({ roomId: '!water:hs' }),
      ),
      takeCoherenceRoomCreate(cache, inFlight, 'need-soil', () =>
        Promise.resolve({ roomId: '!soil:hs' }),
      ),
    ]);
    expect(rooms.map((room) => room.roomId)).toEqual(['!water:hs', '!soil:hs']);
  });
});

describe('runSignalThreadCallPlan', () => {
  it('does not ensure or start when the thread is not a signal', async () => {
    const ensureRoom = vi.fn();
    const onStart = vi.fn();
    await runSignalThreadCallPlan({
      plan: { action: 'refuse', reason: 'not-signal' },
      ensureRoom,
      onStart,
    });
    expect(ensureRoom).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });

  it('joins the signal room, not the leftover room, then starts audio or video there', async () => {
    const joined: string[] = [];
    const ensureRoom = vi.fn();
    const onStart = vi.fn();
    await runSignalThreadCallPlan({
      plan: { action: 'start', roomId: '!signal:hs' },
      ensureRoom,
      currentRoomId: '!leftover:hs',
      joinRoom: async (roomId) => {
        joined.push(roomId);
      },
      onStart,
    });
    expect(ensureRoom).not.toHaveBeenCalled();
    expect(joined).toEqual(['!signal:hs']);
    expect(onStart).toHaveBeenCalledWith('!signal:hs');
  });

  it('skips join when this client is already in the signal room', async () => {
    const joinRoom = vi.fn();
    const onStart = vi.fn();
    await runSignalThreadCallPlan({
      plan: { action: 'start', roomId: '!signal:hs' },
      ensureRoom: vi.fn(),
      currentRoomId: '!signal:hs',
      joinRoom,
      onStart,
    });
    expect(joinRoom).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledWith('!signal:hs');
  });

  it('persists before start, and a failed ensure never starts the call', async () => {
    const events: string[] = [];
    await runSignalThreadCallPlan({
      plan: { action: 'ensure-then-start' },
      currentRoomId: null,
      ensureRoom: async () => {
        events.push('persist');
        return '!signal:hs';
      },
      joinRoom: async (roomId) => {
        events.push(`join:${roomId}`);
      },
      onStart: (roomId) => {
        events.push(`start:${roomId}`);
      },
    });
    expect(events).toEqual(['persist', 'join:!signal:hs', 'start:!signal:hs']);

    const onStart = vi.fn();
    await expect(
      runSignalThreadCallPlan({
        plan: { action: 'ensure-then-start' },
        ensureRoom: async () => {
          throw new Error('persist failed');
        },
        onStart,
      }),
    ).rejects.toThrow(/persist failed/);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('drops the call when the open signal changes before start', async () => {
    const joinRoom = vi.fn();
    const onStart = vi.fn();
    let current = true;
    await runSignalThreadCallPlan({
      plan: { action: 'ensure-then-start' },
      ensureRoom: async () => {
        current = false;
        return '!signal:hs';
      },
      joinRoom,
      onStart,
      isCurrent: () => current,
    });
    expect(joinRoom).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();

    current = true;
    await expect(
      runSignalThreadCallPlan({
        plan: { action: 'start', roomId: '!signal:hs' },
        ensureRoom: vi.fn(),
        joinRoom: async () => {
          current = false;
          throw new SignalThreadCallAborted();
        },
        onStart,
        isCurrent: () => current,
      }),
    ).rejects.toBeInstanceOf(SignalThreadCallAborted);
    expect(onStart).not.toHaveBeenCalled();
  });
});

describe('signal call chrome', () => {
  const ready = {
    isMatrixAvailable: true,
    isMatrixAuthenticated: true,
    isSpaceMember: true,
    isDirectConversation: false,
    roomId: null,
    isStartConversation: false,
    isSignalCallThread: true,
    blockSpaceChatForMembership: false,
  };

  it('shows call controls for a member before the signal room exists', () => {
    expect(signalCallChromeAllowed(ready)).toBe(true);
  });

  it('hides them while membership is unresolved, for non-members, and when signed out', () => {
    expect(
      signalCallChromeAllowed({ ...ready, blockSpaceChatForMembership: true }),
    ).toBe(false);
    expect(signalCallChromeAllowed({ ...ready, isSpaceMember: false })).toBe(
      false,
    );
    expect(
      signalCallChromeAllowed({ ...ready, isMatrixAuthenticated: false }),
    ).toBe(false);
    expect(
      signalCallChromeAllowed({
        ...ready,
        isSignalCallThread: false,
        roomId: null,
      }),
    ).toBe(false);
  });

  it('keeps an ordinary room and a direct chat callable', () => {
    expect(
      signalCallChromeAllowed({
        ...ready,
        isSignalCallThread: false,
        roomId: '!space:hs',
      }),
    ).toBe(true);
    expect(
      signalCallChromeAllowed({
        ...ready,
        isSpaceMember: false,
        isDirectConversation: true,
        isSignalCallThread: false,
        isStartConversation: true,
      }),
    ).toBe(true);
  });

  it('shows the toolbar on a real signal thread and not on other coherence slugs', () => {
    expect(
      showSignalCallToolbar({
        showSidebarCallChrome: true,
        isSignalThread: true,
        isSignalCallThread: true,
      }),
    ).toBe(true);
    expect(
      showSignalCallToolbar({
        showSidebarCallChrome: true,
        isSignalThread: true,
        isSignalCallThread: false,
      }),
    ).toBe(false);
    expect(
      showSignalCallToolbar({
        showSidebarCallChrome: true,
        isSignalThread: false,
        isSignalCallThread: false,
      }),
    ).toBe(true);
  });
});

describe('signal call wiring', () => {
  it('routes signal audio and video through the per-signal plan, not the person-panel path', () => {
    expect(panelSource).toContain('startSignalThreadCall');
    expect(panelSource).toContain('planSignalThreadCall');
    expect(panelSource).toContain('runSignalThreadCallPlan');
    expect(panelSource).toContain("startSignalThreadCall('audio')");
    expect(panelSource).toContain("startSignalThreadCall('video')");
    expect(panelSource).toContain('launchPersonPanelCall(kind, target)');
    expect(panelSource).not.toContain(
      'showSidebarCallChrome && !isSignalThread',
    );
    expect(panelSource).toContain('roomType: HYPHA_ROOM_TYPES.signal');
  });
});
