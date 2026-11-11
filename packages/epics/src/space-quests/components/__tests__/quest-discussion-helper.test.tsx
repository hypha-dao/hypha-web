// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuestRecord, QuestStatus } from '@hypha-platform/core/client';
import { QUEST_HELPER_NAME } from '@hypha-platform/core/client';
import { getAgentAvatarInitials } from '../../../common/ai-agent-competencies';
import { isAgentChatAuthor } from '../../../common/human-chat-panel/agent-initials-avatar';
import { showsChatMessageActions } from '../../../common/human-chat-panel/human-chat-panel-messages';
import { mentionCandidateMatchRank } from '../../../common/human-chat-panel/human-chat-mention-search';
import { questHelperTurnMessage } from '../../utils/quest-draft-assistant';
import { SAVED_QUEST_HELPER_INTRO } from '../../utils/quest-saved-helper';
import {
  QUEST_HELPER_MENTION_ID,
  withQuestHelperMention,
} from '../../utils/quest-helper-mention';
import {
  QuestDiscussionHelper,
  appendQuestHelperMessages,
  questHelperOwnsRoomMessage,
  questHelperTimelineRows,
  type QuestHelperThread,
} from '../quest-discussion-helper';

const harness = vi.hoisted(() => ({
  personId: 7,
  status: 'active' as QuestStatus,
  patchQuest: vi.fn(),
}));

function questFixture(): QuestRecord {
  return {
    id: 1,
    spaceId: 1,
    spaceSlug: 'sandbox',
    spaceTitle: 'Sandbox',
    slug: 'onboarding',
    name: 'Onboarding',
    goal: 'Keep the saved goal',
    scopeIn: [],
    scopeOut: [],
    scopeInMarkdown: '',
    scopeOutMarkdown: '',
    successCriteria: '',
    rewards: [],
    status: harness.status,
    targetDate: null,
    leadPersonId: 7,
    leadName: 'Ada Lovelace',
    leadAvatarUrl: null,
    creatorPersonId: 7,
    proposalDocumentId: null,
    proposalSlug: null,
    proposalWeb3Id: null,
    proposalStatus: null,
    acceptedAt: null,
    chatRoomId: 'room-1',
    health: {
      state: 'on_track',
      marker: 80,
      summary: '',
      updatesThisWeek: 0,
      lastUpdateAt: null,
      generatedAt: null,
      daysToTarget: null,
    },
    stewardHealthSummaries: false,
    memberUpdateAlerts: false,
    deliverablesEnabled: false,
    milestones: [],
    members: [
      {
        id: 3,
        questId: 1,
        personId: 7,
        memberName: 'Ada Lovelace',
        memberAvatarUrl: null,
        roleLabel: 'Lead',
        responsibilities: [],
        order: 1,
        isLead: true,
      },
    ],
    deliverables: [],
    updates: [],
    latestUpdateLine: null,
    latestUpdateAt: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

function HelperHost({
  onResult,
}: {
  onResult: (thread: QuestHelperThread | null) => void;
}) {
  const [thread, setThread] = React.useState<QuestHelperThread | null>(null);
  return (
    <div>
      <QuestDiscussionHelper
        spaceSlug="sandbox"
        questSlug="onboarding"
        onThread={(next) => {
          setThread(next);
          onResult(next);
        }}
      />
      <div data-testid="helper-transcript">
        {thread?.messages.map((message) => (
          <p key={message.id}>{message.text}</p>
        ))}
      </div>
    </div>
  );
}

vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    getAccessToken: async () => null,
  }),
}));

vi.mock('@hypha-platform/core/client', async () => {
  const actual = await vi.importActual<
    typeof import('@hypha-platform/core/client')
  >('@hypha-platform/core/client');
  return {
    ...actual,
    useMe: () => ({
      person: {
        id: harness.personId,
        name: 'Ada',
        surname: 'Lovelace',
        avatarUrl: null,
      },
    }),
    useSpaceBySlug: () => ({ space: null }),
  };
});

vi.mock('../../hooks/use-space-quests', async () => {
  const actual = await vi.importActual<
    typeof import('../../hooks/use-space-quests')
  >('../../hooks/use-space-quests');
  return {
    ...actual,
    useSpaceQuestDetail: () => ({
      quest: questFixture(),
      isLoading: false,
      error: null,
      refresh: async () => undefined,
    }),
    useQuestSpaceMembers: () => [],
    patchSpaceQuestRequest: (...args: unknown[]) => harness.patchQuest(...args),
  };
});

describe('quest discussion helper', () => {
  it('is rendered in the quest Matrix discussion, not as its own panel', () => {
    const panel = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../common/human-right-panel.tsx',
      ),
      'utf8',
    );
    const mount = panel.slice(
      panel.indexOf("coherenceChannel === 'quest'"),
      panel.indexOf('<QuestDiscussionHelper') + 400,
    );
    expect(mount).toContain('<QuestDiscussionHelper');
    expect(mount).toContain('questSlug={coherenceSlug.trim()}');
    expect(mount).toContain('onThread={onHelperThread}');
    expect(panel.indexOf('if (questDraft)')).toBeLessThan(
      panel.indexOf('<QuestDiscussionHelper'),
    );
    expect(panel.match(/<HumanChatPanelMessages/g)).toHaveLength(1);
    expect(panel.match(/<HumanChatPanelChatBar/g)).toHaveLength(1);
    expect(panel).toContain('appendQuestHelperMessages');
    expect(panel).toContain("coherenceChannel !== 'quest'");
    const helper = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../quest-discussion-helper.tsx',
      ),
      'utf8',
    );
    expect(helper).not.toContain('SpaceQuestChatBody');
    expect(helper).not.toContain('HumanChatPanelChatBar');
    expect(helper).not.toContain('HumanChatPanelMessages');
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    harness.personId = 7;
    harness.status = 'active';
    harness.patchQuest.mockReset();
  });

  it('keeps the helper available without an automatic greeting', async () => {
    const thread: { current: QuestHelperThread | null } = { current: null };
    render(<HelperHost onResult={(next) => (thread.current = next)} />);
    await waitFor(() => {
      expect(thread.current).not.toBeNull();
    });
    expect(thread.current?.messages).toEqual([]);
    expect(screen.queryByText(SAVED_QUEST_HELPER_INTRO)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(thread.current?.accept('Helper, what is the goal?')).toBe(true);
    expect(await screen.findByText(/Keep the saved goal/)).toBeTruthy();
  });

  it('stays hidden from a viewer who cannot edit the quest', async () => {
    harness.personId = 99;
    const thread: { current: QuestHelperThread | null } = { current: null };
    render(<HelperHost onResult={(next) => (thread.current = next)} />);
    await screen.findByTestId('helper-transcript');
    expect(thread.current).toBeNull();
    expect(screen.queryByText(SAVED_QUEST_HELPER_INTRO)).toBeNull();
  });

  it('shows the helper by quest status', async () => {
    for (const status of ['active', 'paused'] as const) {
      cleanup();
      window.sessionStorage.clear();
      harness.personId = 7;
      harness.status = status;
      const thread: { current: QuestHelperThread | null } = { current: null };
      render(<HelperHost onResult={(next) => (thread.current = next)} />);
      await waitFor(() => {
        expect(thread.current).not.toBeNull();
      });
      expect(thread.current?.messages).toEqual([]);
      expect(screen.queryByText(SAVED_QUEST_HELPER_INTRO)).toBeNull();
    }

    for (const status of ['proposed', 'completed', 'archived'] as const) {
      cleanup();
      window.sessionStorage.clear();
      harness.personId = 7;
      harness.status = status;
      const thread: { current: QuestHelperThread | null } = { current: null };
      render(<HelperHost onResult={(next) => (thread.current = next)} />);
      await screen.findByTestId('helper-transcript');
      expect(screen.queryByText(SAVED_QUEST_HELPER_INTRO)).toBeNull();
      expect(thread.current).toBeNull();
    }
  });

  it('keeps a section suggestion inside the discussion until it can be saved', async () => {
    harness.patchQuest.mockResolvedValue(questFixture());
    const thread: { current: QuestHelperThread | null } = { current: null };
    render(<HelperHost onResult={(next) => (thread.current = next)} />);
    await waitFor(() => {
      expect(thread.current).not.toBeNull();
    });
    expect(screen.queryByText(SAVED_QUEST_HELPER_INTRO)).toBeNull();
    expect(
      thread.current?.accept('Change the goal to ship the checklist'),
    ).toBe(true);
    expect(await screen.findByText(/not saved yet/i)).toBeTruthy();
    expect(
      screen.getByText(/do you want that to be in the goal/i),
    ).toBeTruthy();
    expect(harness.patchQuest).not.toHaveBeenCalled();

    expect(thread.current?.accept('yes')).toBe(true);
    expect(await screen.findByText('Saved the Goal.')).toBeTruthy();
    expect(harness.patchQuest).toHaveBeenCalledTimes(1);
    const saved = harness.patchQuest.mock.calls[0]?.[0] as {
      patch?: { goal?: string };
    };
    expect(saved.patch?.goal).toMatch(/ship the checklist/i);
  });

  it('leaves ordinary room chat out of the helper', () => {
    expect(questHelperOwnsRoomMessage('See you Thursday', false)).toBe(false);
    expect(questHelperOwnsRoomMessage('yes', false)).toBe(false);
    expect(questHelperOwnsRoomMessage('Helpers, meet Thursday', false)).toBe(
      false,
    );
    expect(
      questHelperOwnsRoomMessage(
        'Change the goal to ship the checklist',
        false,
      ),
    ).toBe(true);
    expect(questHelperOwnsRoomMessage('yes', true)).toBe(true);
  });

  it('routes a message addressed to the Helper when nothing is pending', () => {
    const addressed = [
      'Helper, what is the goal?',
      '@Helper what is the goal?',
      '@Quest Helper what is the goal?',
      '@quest helper: what is the goal?',
      'HELPER, what is the goal?',
      `@\u200BQuest Helper what is the goal?`,
    ];
    for (const message of addressed) {
      expect(questHelperOwnsRoomMessage(message, false)).toBe(true);
      expect(questHelperTurnMessage(message)).toBe('what is the goal?');
    }
    expect(
      questHelperOwnsRoomMessage(
        'Helper: what does the Goal section currently say?',
        false,
      ),
    ).toBe(true);
    expect(
      questHelperTurnMessage(
        'Helper: what does the Goal section currently say?',
      ),
    ).toBe('what does the Goal section currently say?');
    expect(
      questHelperOwnsRoomMessage('@AI Agents what is the goal?', false),
    ).toBe(true);
  });

  it('answers an addressed question after a discard, and labels it as the member', async () => {
    const thread: { current: QuestHelperThread | null } = { current: null };
    render(<HelperHost onResult={(next) => (thread.current = next)} />);
    await waitFor(() => {
      expect(thread.current).not.toBeNull();
    });
    expect(
      thread.current?.accept('Change the goal to ship the checklist'),
    ).toBe(true);
    expect(await screen.findByText(/not saved yet/i)).toBeTruthy();
    expect(thread.current?.accept('no')).toBe(true);
    expect(await screen.findByText(/left that out/i)).toBeTruthy();

    expect(thread.current?.accept('Helper, what is the goal?')).toBe(true);
    expect(await screen.findByText(/Keep the saved goal/)).toBeTruthy();
    const user = thread.current?.messages.find(
      (message) => message.text === 'Helper, what is the goal?',
    );
    expect(user?.text).toBe('Helper, what is the goal?');
    expect(user?.senderName).toBeUndefined();
    const reply = thread.current?.messages.find((message) =>
      message.text.includes('Keep the saved goal'),
    );
    expect(reply?.senderName).toBe(QUEST_HELPER_NAME);
    expect(reply?.text).not.toMatch(/not saved yet/i);
  });

  it('keeps this build’s helper turns after a reload in the same tab', async () => {
    const thread: { current: QuestHelperThread | null } = { current: null };
    const first = render(
      <HelperHost onResult={(next) => (thread.current = next)} />,
    );
    await waitFor(() => {
      expect(thread.current).not.toBeNull();
    });
    expect(thread.current?.accept('@Quest Helper what is the goal?')).toBe(
      true,
    );
    expect(await screen.findByText(/Keep the saved goal/)).toBeTruthy();
    const stored = window.sessionStorage.getItem(
      'hypha-quest-helper:sandbox:onboarding',
    );
    expect(stored).toContain('@Quest Helper what is the goal?');
    expect(stored).toContain('Keep the saved goal');
    first.unmount();

    render(<HelperHost onResult={(next) => (thread.current = next)} />);
    expect(
      await screen.findByText('@Quest Helper what is the goal?'),
    ).toBeTruthy();
    expect(screen.getByText(/Keep the saved goal/)).toBeTruthy();
    expect(screen.queryByText(SAVED_QUEST_HELPER_INTRO)).toBeNull();
  });

  it('drops a stored automatic greeting and keeps the later turns', async () => {
    window.sessionStorage.setItem(
      'hypha-quest-helper:sandbox:onboarding',
      JSON.stringify({
        messages: [
          {
            id: 'helper-m1',
            role: 'member',
            text: SAVED_QUEST_HELPER_INTRO,
            timestamp: '2026-11-09T12:00:00.000Z',
            senderName: 'Quest Helper',
          },
          {
            id: 'hu-1',
            role: 'user',
            text: 'Helper, what is the goal?',
            timestamp: '2026-11-09T12:01:00.000Z',
          },
        ],
        pending: null,
        step: 0,
      }),
    );
    render(<HelperHost onResult={() => undefined} />);
    expect(await screen.findByText('Helper, what is the goal?')).toBeTruthy();
    expect(screen.queryByText(SAVED_QUEST_HELPER_INTRO)).toBeNull();
  });

  it('shows a routed member line as You and the Helper with the agent face', () => {
    const rows = questHelperTimelineRows([
      {
        id: 'user-1',
        role: 'user',
        text: 'Helper, what is the goal?',
        senderName: 'Vlad Hramtsov',
        avatarUrl: 'https://example.test/vlad.png',
        timestamp: new Date('2026-11-09T12:00:00.000Z'),
      },
      {
        id: 'helper-1',
        role: 'member',
        text: SAVED_QUEST_HELPER_INTRO,
        senderName: QUEST_HELPER_NAME,
        timestamp: new Date('2026-11-09T12:00:01.000Z'),
      },
    ]);
    expect(rows[0]).not.toHaveProperty('senderName');
    expect(rows[0]?.avatarUrl).toBe('https://example.test/vlad.png');
    expect(rows[1]?.senderName).toBe(QUEST_HELPER_NAME);
    expect(
      isAgentChatAuthor({
        agentSpecialistId: rows[1]?.agentSpecialistId,
        label: rows[1]?.senderName,
      }),
    ).toBe(true);
    expect(getAgentAvatarInitials(QUEST_HELPER_NAME)).toBe('QH');
    expect(showsChatMessageActions({ isSynthetic: true })).toBe(false);
    expect(showsChatMessageActions({ isSynthetic: false })).toBe(true);
  });

  it('offers Quest Helper in the @ picker for an open quest coach', () => {
    const people = [
      {
        userId: '@ada:example.org',
        displayLabel: 'Ada Lovelace',
        rowKey: 'ada',
      },
    ];
    expect(withQuestHelperMention(people, false)).toEqual(people);
    const open = withQuestHelperMention(
      [
        {
          userId: '@bot:example.org',
          displayLabel: 'AI Agents',
          rowKey: 'agent',
        },
        ...people,
      ],
      true,
      { kind: 'space', logoUrl: 'https://example.test/logo.png' },
    );
    expect(open.map((row) => row.displayLabel)).toEqual([
      'AI Agents',
      'Quest Helper',
      'Ada Lovelace',
    ]);
    const helper = open[1];
    expect(helper?.userId).toBe(QUEST_HELPER_MENTION_ID);
    expect(mentionCandidateMatchRank(helper!, 'quest')).toBe('start');
    expect(mentionCandidateMatchRank(helper!, 'helper')).toBe('start');
  });

  it('puts the helper turns into the same timeline as the quest channel', () => {
    const room = [
      {
        id: 'room-1',
        timestamp: new Date('2026-11-09T12:32:00.000Z'),
        text: 'Quest accepted',
      },
    ];
    const helper = [
      {
        id: 'quest-helper:helper-m1',
        timestamp: new Date('2026-11-09T19:55:00.000Z'),
        text: SAVED_QUEST_HELPER_INTRO,
      },
    ];
    expect(
      appendQuestHelperMessages(room, helper).map((row) => row.id),
    ).toEqual(['room-1', 'quest-helper:helper-m1']);
    expect(appendQuestHelperMessages(room, []).map((row) => row.text)).toEqual([
      'Quest accepted',
    ]);
  });
});
