// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const matrix = vi.hoisted(() => {
  const kick = vi.fn(
    async (_roomId: string, _userId: string, _reason?: string) => undefined,
  );
  const ensureRoomMembers = vi.fn(
    async (
      roomId: string,
      _matrixUserIds: readonly string[],
      options?: { pruneAbsent?: boolean },
    ) => {
      // Mirror production: pruneAbsent is what makes `client.kick` run.
      if (options?.pruneAbsent) {
        await kick(
          roomId,
          '@former:example.org',
          'No longer a member of this space',
        );
      }
      return [];
    },
  );
  const client = {
    getUserId: () => '@me:example.org',
    getRoom: () => null,
    kick,
    on: vi.fn(),
    off: vi.fn(),
  };
  return {
    kick,
    ensureRoomMembers,
    client,
    joinRoom: vi.fn(async (roomId: string) => roomId),
    getRoomMessages: vi.fn(() => [
      {
        id: '$msg1',
        sender: '@me:example.org',
        content: 'hello',
        msgtype: 'm.text' as const,
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]),
    loadRoomHistory: vi.fn(async () => ({ hasMoreOlder: false })),
    getRoomMembers: vi.fn(async () => []),
    registerRoomListener: vi.fn(),
    unregisterRoomListener: vi.fn(),
    createRoom: vi.fn(),
    sendMessage: vi.fn(),
    editRoomMessage: vi.fn(),
    redactRoomEvent: vi.fn(),
    toggleReaction: vi.fn(),
  };
});

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('swr', () => ({
  default: () => ({
    data: [
      {
        id: 1,
        name: 'Ada',
        surname: 'Lovelace',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
  }),
}));

vi.mock('@hypha-platform/core/client', async () => {
  const actual = await vi.importActual<
    typeof import('@hypha-platform/core/client')
  >('@hypha-platform/core/client');
  return {
    ...actual,
    useJwt: () => ({ jwt: 'token', isLoadingJwt: false }),
    useMe: () => ({
      person: { id: 99, name: 'Me', surname: 'User', avatarUrl: null },
    }),
    useSpaceBySlug: () => ({ space: undefined }),
    useMatrixUserIdsByPersonIds: () => ({
      personIdToMatrixUserId: { 1: '@ada:example.org' },
      isLoading: false,
    }),
    useMatrix: () => ({
      client: matrix.client,
      createRoom: matrix.createRoom,
      joinRoom: matrix.joinRoom,
      getRoomMessages: matrix.getRoomMessages,
      loadRoomHistory: matrix.loadRoomHistory,
      getRoomMembers: matrix.getRoomMembers,
      registerRoomListener: matrix.registerRoomListener,
      unregisterRoomListener: matrix.unregisterRoomListener,
      sendMessage: matrix.sendMessage,
      ensureRoomMembers: matrix.ensureRoomMembers,
      editRoomMessage: matrix.editRoomMessage,
      redactRoomEvent: matrix.redactRoomEvent,
      toggleReaction: matrix.toggleReaction,
    }),
  };
});

vi.mock('../human-chat-panel', () => ({
  HumanChatPanelChatBar: () => <div data-testid="chat-bar" />,
  HumanChatPanelMessages: () => <div data-testid="messages" />,
}));

vi.mock('../human-chat-panel/human-chat-panel-typing-indicator', () => ({
  HumanChatPanelTypingIndicator: () => null,
}));

vi.mock('../human-chat-panel/use-chat-room-typing', () => ({
  useChatRoomTyping: () => ({ typingPeers: [], setComposerTyping: vi.fn() }),
}));

import { HYPHA_ROOM_TYPES } from '@hypha-platform/core/client';
import { MatrixDiscussionThread } from '../matrix-discussion-thread';

describe('MatrixDiscussionThread membership sync on mount', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('never kicks Matrix members just because the thread mounted', async () => {
    render(
      <MatrixDiscussionThread
        threadKey="proposal-1"
        initialChatRoomId="!proposal:example.org"
        chatRoomResolved
        roomTitle="Proposal discussion"
        roomType={HYPHA_ROOM_TYPES.proposal}
        persistRoomId={async (roomId) => roomId}
        spaceSlug="sandbox"
        agent={{ label: 'AI Agents', skills: [] }}
        agentContext={{ kind: 'proposal', documentSlug: 'proposal-1' }}
        placeholder="Say something"
        connectingLabel="Connecting"
        unavailableLabel="Unavailable"
        logLabel="ProposalDiscussionChat"
      />,
    );

    await waitFor(() => {
      expect(matrix.ensureRoomMembers).toHaveBeenCalled();
    });

    expect(matrix.kick).not.toHaveBeenCalled();
    for (const [, , options] of matrix.ensureRoomMembers.mock.calls) {
      expect(options?.pruneAbsent).not.toBe(true);
    }
  });
});
