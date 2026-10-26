import { describe, expect, it, vi } from 'vitest';

import {
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

describe('hasHumanTimelineMessages', () => {
  it('ignores synthetic welcome rows', () => {
    expect(
      hasHumanTimelineMessages([{ isSynthetic: true }, { isSynthetic: false }]),
    ).toBe(true);
    expect(hasHumanTimelineMessages([{ isSynthetic: true }])).toBe(false);
    expect(hasHumanTimelineMessages([])).toBe(false);
  });
});
