import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  callAppliesToCurrentChatRoom,
  hasHumanTimelineMessages,
  runPersonPanelCallStart,
  shouldRefusePersonPanelCall,
} from '../person-panel-call';

describe('shouldRefusePersonPanelCall', () => {
  it('refuses a direct chat with no room id', () => {
    expect(
      shouldRefusePersonPanelCall({
        isDirectConversation: true,
        roomId: null,
        coherenceRoomId: null,
        hasHumanMessages: false,
      }),
    ).toBe(true);
  });

  it('refuses Start-a-conversation even when an empty DM room id exists', () => {
    expect(
      shouldRefusePersonPanelCall({
        isDirectConversation: true,
        roomId: '!empty',
        coherenceRoomId: '!empty',
        hasHumanMessages: false,
      }),
    ).toBe(true);
  });

  it('allows a real direct conversation that already has messages', () => {
    expect(
      shouldRefusePersonPanelCall({
        isDirectConversation: true,
        roomId: '!dm',
        coherenceRoomId: '!dm',
        hasHumanMessages: true,
      }),
    ).toBe(false);
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
  });
});

describe('runPersonPanelCallStart', () => {
  it('phone and video refuse when Start-a-conversation / null room is active', () => {
    const onRefuse = vi.fn();
    const onStart = vi.fn();
    const refuse = shouldRefusePersonPanelCall({
      isDirectConversation: true,
      roomId: '!empty',
      coherenceRoomId: '!empty',
      hasHumanMessages: false,
    });
    runPersonPanelCallStart({ refuse, onRefuse, onStart });
    expect(onRefuse).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
  });

  it('starts the call when a peer conversation is already active', () => {
    const onRefuse = vi.fn();
    const onStart = vi.fn();
    runPersonPanelCallStart({
      refuse: shouldRefusePersonPanelCall({
        isDirectConversation: true,
        roomId: '!dm',
        coherenceRoomId: '!dm',
        hasHumanMessages: true,
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
