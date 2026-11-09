// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuestRecord, QuestStatus } from '@hypha-platform/core/client';
import { SAVED_QUEST_HELPER_INTRO } from '../../utils/quest-saved-helper';
import { QuestDiscussionHelper } from '../quest-discussion-helper';
import type { SpaceQuestDraftPanelSession } from '../../../common/human-chat-panel-context';

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

vi.mock('../space-quest-chat-panel', () => ({
  SpaceQuestChatBody: ({
    session,
  }: {
    session: SpaceQuestDraftPanelSession;
  }) => (
    <div data-testid="quest-helper-thread">
      <p data-testid="quest-helper-coach">{session.coach}</p>
      {session.messages.map((message) => (
        <p key={message.id}>{message.text}</p>
      ))}
      <input
        aria-label="Helper message"
        value={session.input}
        onChange={(event) => session.onInputChange(event.target.value)}
      />
      <button type="button" onClick={session.onSend}>
        Send helper
      </button>
    </div>
  ),
}));

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
    expect(panel.indexOf('if (questDraft)')).toBeLessThan(
      panel.indexOf('<QuestDiscussionHelper'),
    );
  });

  afterEach(() => {
    cleanup();
    harness.personId = 7;
    harness.status = 'active';
    harness.patchQuest.mockReset();
  });

  it('shows the saved helper inside the discussion for an editor', () => {
    render(
      <QuestDiscussionHelper spaceSlug="sandbox" questSlug="onboarding" />,
    );
    const helper = screen.getByTestId('quest-discussion-helper');
    expect(helper.getAttribute('aria-label')).toBe('Quest Helper');
    expect(helper.textContent).toContain(SAVED_QUEST_HELPER_INTRO);
    expect(screen.getByTestId('quest-helper-coach').textContent).toBe(
      'quest-helper',
    );
  });

  it('stays hidden from a viewer and from a proposed quest', () => {
    harness.personId = 99;
    const { rerender } = render(
      <QuestDiscussionHelper spaceSlug="sandbox" questSlug="onboarding" />,
    );
    expect(screen.queryByTestId('quest-discussion-helper')).toBeNull();

    harness.personId = 7;
    harness.status = 'proposed';
    rerender(
      <QuestDiscussionHelper spaceSlug="sandbox" questSlug="onboarding" />,
    );
    expect(screen.queryByTestId('quest-discussion-helper')).toBeNull();
  });

  it('keeps a section suggestion inside the discussion until it can be saved', async () => {
    render(
      <QuestDiscussionHelper spaceSlug="sandbox" questSlug="onboarding" />,
    );
    fireEvent.change(screen.getByLabelText('Helper message'), {
      target: { value: 'Change the goal to ship the checklist' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send helper' }));
    expect(await screen.findByText(/not saved yet/i)).toBeTruthy();
    expect(screen.getByText(/suggestion that was waiting/i)).toBeTruthy();
    expect(
      screen.getByText('Change the goal to ship the checklist'),
    ).toBeTruthy();
    expect(harness.patchQuest).toHaveBeenCalled();
    const saved = harness.patchQuest.mock.calls[0]?.[0] as {
      patch?: { goal?: string };
    };
    expect(saved.patch?.goal).toMatch(/ship the checklist/i);
  });
});
