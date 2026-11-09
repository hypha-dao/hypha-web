// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuestRecord, QuestStatus } from '@hypha-platform/core/client';
import { SAVED_QUEST_HELPER_INTRO } from '../../utils/quest-saved-helper';
import {
  QuestDiscussionHelper,
  appendQuestHelperMessages,
  questHelperOwnsRoomMessage,
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

  it('shows the saved helper inside the one discussion for an editor', async () => {
    const thread: { current: QuestHelperThread | null } = { current: null };
    render(<HelperHost onResult={(next) => (thread.current = next)} />);
    expect(await screen.findByText(SAVED_QUEST_HELPER_INTRO)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(thread.current?.messages.map((message) => message.text)).toContain(
      SAVED_QUEST_HELPER_INTRO,
    );
  });

  it('stays hidden from a viewer and from a proposed quest', async () => {
    harness.personId = 99;
    const thread: { current: QuestHelperThread | null } = { current: null };
    const { rerender } = render(
      <HelperHost onResult={(next) => (thread.current = next)} />,
    );
    await screen.findByTestId('helper-transcript');
    expect(thread.current).toBeNull();
    expect(screen.queryByText(SAVED_QUEST_HELPER_INTRO)).toBeNull();

    harness.personId = 7;
    harness.status = 'proposed';
    rerender(<HelperHost onResult={(next) => (thread.current = next)} />);
    expect(screen.queryByText(SAVED_QUEST_HELPER_INTRO)).toBeNull();
  });

  it('keeps a section suggestion inside the discussion until it can be saved', async () => {
    harness.patchQuest.mockResolvedValue(questFixture());
    const thread: { current: QuestHelperThread | null } = { current: null };
    render(<HelperHost onResult={(next) => (thread.current = next)} />);
    expect(await screen.findByText(SAVED_QUEST_HELPER_INTRO)).toBeTruthy();
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
    expect(
      questHelperOwnsRoomMessage(
        'Change the goal to ship the checklist',
        false,
      ),
    ).toBe(true);
    expect(questHelperOwnsRoomMessage('yes', true)).toBe(true);
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
