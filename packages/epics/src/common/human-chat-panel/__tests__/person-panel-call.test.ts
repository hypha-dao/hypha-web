import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  callAppliesToCurrentChatRoom,
  hasHumanTimelineMessages,
  planPersonPanelCall,
  runPersonPanelCallPlan,
  runPersonPanelCallStart,
  shouldLeaveCallOnPersonPanelRefuse,
  shouldRefusePersonPanelCall,
} from '../person-panel-call';

describe('shouldRefusePersonPanelCall', () => {
  it('allows Start-a-conversation / no-human-messages so the room can be ensured', () => {
    expect(
      shouldRefusePersonPanelCall({
        isDirectConversation: true,
        roomId: null,
        coherenceRoomId: null,
        hasHumanMessages: false,
      }),
    ).toBe(false);
    expect(
      planPersonPanelCall({
        isDirectConversation: true,
        roomId: null,
        coherenceRoomId: null,
        hasHumanMessages: false,
      }),
    ).toEqual({ action: 'ensure-then-start' });
  });

  it('ensures when only one of the room ids is present', () => {
    expect(
      planPersonPanelCall({
        isDirectConversation: true,
        roomId: '!empty',
        coherenceRoomId: null,
        hasHumanMessages: false,
      }),
    ).toEqual({ action: 'ensure-then-start' });
    expect(
      shouldRefusePersonPanelCall({
        isDirectConversation: true,
        roomId: null,
        coherenceRoomId: '!empty',
        hasHumanMessages: true,
      }),
    ).toBe(false);
  });

  it('allows an existing joined direct room even if the timeline is empty', () => {
    expect(
      shouldRefusePersonPanelCall({
        isDirectConversation: true,
        roomId: '!empty',
        coherenceRoomId: '!empty',
        hasHumanMessages: false,
      }),
    ).toBe(false);
    expect(
      planPersonPanelCall({
        isDirectConversation: true,
        roomId: '!empty',
        coherenceRoomId: '!empty',
        hasHumanMessages: false,
      }),
    ).toEqual({ action: 'ensure-then-start' });
  });

  it('refuses when roomId and coherenceRoomId disagree during a switch', () => {
    expect(
      shouldRefusePersonPanelCall({
        isDirectConversation: true,
        roomId: '!stale',
        coherenceRoomId: '!next',
        hasHumanMessages: true,
      }),
    ).toBe(true);
    expect(
      planPersonPanelCall({
        isDirectConversation: true,
        roomId: '!stale',
        coherenceRoomId: '!next',
        hasHumanMessages: true,
      }),
    ).toEqual({ action: 'refuse' });
  });

  it('starts immediately on a real direct conversation that already has messages', () => {
    expect(
      planPersonPanelCall({
        isDirectConversation: true,
        roomId: '!dm',
        coherenceRoomId: '!dm',
        hasHumanMessages: true,
      }),
    ).toEqual({ action: 'start', roomId: '!dm' });
  });

  it('does not refuse space or signal rooms', () => {
    expect(
      shouldRefusePersonPanelCall({
        isDirectConversation: false,
        roomId: '!space',
        coherenceRoomId: '!space',
        hasHumanMessages: false,
      }),
    ).toBe(false);
    expect(
      planPersonPanelCall({
        isDirectConversation: false,
        roomId: '!space',
        coherenceRoomId: '!space',
        hasHumanMessages: false,
      }),
    ).toEqual({ action: 'start', roomId: '!space' });
  });
});

describe('shouldLeaveCallOnPersonPanelRefuse', () => {
  it('leaves when there is no active call session room', () => {
    expect(shouldLeaveCallOnPersonPanelRefuse(null, '!dm')).toBe(true);
    expect(shouldLeaveCallOnPersonPanelRefuse('', '!dm')).toBe(true);
    expect(shouldLeaveCallOnPersonPanelRefuse(undefined, null)).toBe(true);
  });

  it('leaves leftover chrome for the current room', () => {
    expect(shouldLeaveCallOnPersonPanelRefuse('!dm', '!dm')).toBe(true);
  });

  it('does not tear down a call owned by another room', () => {
    expect(shouldLeaveCallOnPersonPanelRefuse('!other', '!dm')).toBe(false);
    expect(shouldLeaveCallOnPersonPanelRefuse('!other', null)).toBe(false);
  });
});

describe('runPersonPanelCallPlan', () => {
  it('ensures a DM then starts instead of refusing Start-a-conversation', async () => {
    const onRefuse = vi.fn();
    const onStart = vi.fn();
    const ensureRoom = vi.fn().mockResolvedValue('!ensured');
    await runPersonPanelCallPlan({
      plan: planPersonPanelCall({
        isDirectConversation: true,
        roomId: null,
        coherenceRoomId: null,
        hasHumanMessages: false,
      }),
      ensureRoom,
      onRefuse,
      onStart,
    });
    expect(ensureRoom).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledWith('!ensured');
    expect(onRefuse).not.toHaveBeenCalled();
  });

  it('starts the call in a joined empty DM after ensuring the real room', async () => {
    const onRefuse = vi.fn();
    const onStart = vi.fn();
    await runPersonPanelCallPlan({
      plan: planPersonPanelCall({
        isDirectConversation: true,
        roomId: '!empty',
        coherenceRoomId: '!empty',
        hasHumanMessages: false,
      }),
      ensureRoom: async () => '!empty',
      onRefuse,
      onStart,
    });
    expect(onStart).toHaveBeenCalledWith('!empty');
    expect(onRefuse).not.toHaveBeenCalled();
  });

  it('starts immediately when a peer conversation is already active', async () => {
    const onRefuse = vi.fn();
    const onStart = vi.fn();
    const ensureRoom = vi.fn();
    await runPersonPanelCallPlan({
      plan: planPersonPanelCall({
        isDirectConversation: true,
        roomId: '!dm',
        coherenceRoomId: '!dm',
        hasHumanMessages: true,
      }),
      ensureRoom,
      onRefuse,
      onStart,
    });
    expect(ensureRoom).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledWith('!dm');
    expect(onRefuse).not.toHaveBeenCalled();
  });
});

describe('runPersonPanelCallStart', () => {
  it('does not refuse Start-a-conversation / no-human-messages', () => {
    const onRefuse = vi.fn();
    const onStart = vi.fn();
    runPersonPanelCallStart({
      refuse: shouldRefusePersonPanelCall({
        isDirectConversation: true,
        roomId: null,
        coherenceRoomId: null,
        hasHumanMessages: false,
      }),
      onRefuse,
      onStart,
    });
    expect(onStart).toHaveBeenCalledOnce();
    expect(onRefuse).not.toHaveBeenCalled();
  });
});

describe('callAppliesToCurrentChatRoom', () => {
  it('treats a room-less Start-a-conversation as a match only with no session', () => {
    expect(callAppliesToCurrentChatRoom(null, null)).toBe(true);
    expect(callAppliesToCurrentChatRoom('', '')).toBe(true);
    expect(callAppliesToCurrentChatRoom(null, '!other')).toBe(false);
    expect(callAppliesToCurrentChatRoom('', '!other')).toBe(false);
  });

  it('requires the session room to match when a chat room is open', () => {
    expect(callAppliesToCurrentChatRoom('!dm', null)).toBe(true);
    expect(callAppliesToCurrentChatRoom('!dm', '!dm')).toBe(true);
    expect(callAppliesToCurrentChatRoom('!dm', '!other')).toBe(false);
  });
});

describe('Start-a-conversation call toolbar', () => {
  it('marks self-presence checked when roomId is missing so phone/video render', () => {
    const hook = readFileSync(
      resolve(
        __dirname,
        '../../../../../core/src/matrix/client/hooks/use-space-group-call.ts',
      ),
      'utf8',
    );
    const panel = readFileSync(
      resolve(__dirname, '../../human-right-panel.tsx'),
      'utf8',
    );
    expect(hook).toContain('if (!client) return;');
    expect(hook).toContain('if (!roomId?.trim()) {');
    expect(hook).toContain('setSelfPresenceChecked(true);');
    expect(panel).toContain(
      'chatRoomOwnsCallSession(roomId, callSessionRoomId)',
    );
    expect(panel).toContain(
      'const callActionsChecked = inSpaceCall || spaceCallSelfPresenceChecked;',
    );
    const toolbarAt = panel.indexOf('<HumanChatPanelCallToolbar');
    const checkedAt = panel.lastIndexOf('callActionsChecked ? (', toolbarAt);
    expect(toolbarAt).toBeGreaterThan(-1);
    expect(checkedAt).toBeGreaterThan(-1);
    expect(checkedAt).toBeLessThan(toolbarAt);
  });
});

describe('hasHumanTimelineMessages', () => {
  it('ignores synthetic welcome rows', () => {
    expect(
      hasHumanTimelineMessages([{ isSynthetic: true }, { isSynthetic: false }]),
    ).toBe(true);
    expect(hasHumanTimelineMessages([{ isSynthetic: true }])).toBe(false);
    expect(hasHumanTimelineMessages([])).toBe(false);
  });
});
