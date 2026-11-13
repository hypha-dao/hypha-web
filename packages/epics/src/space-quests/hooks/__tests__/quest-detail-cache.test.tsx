// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mutate, SWRConfig } from 'swr';
import type {
  QuestRecord,
  SpaceQuestsOverview,
} from '@hypha-platform/core/client';
import {
  seedSpaceQuestDetailCache,
  SPACE_QUESTS_SWR_KEY,
  spaceQuestDetailKey,
  spaceQuestOverviewKey,
  useSpaceQuestDetail,
} from '../use-space-quests';

vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    getAccessToken: async () => 'token',
    user: { id: 'user-1' },
    isLoading: false,
  }),
}));

function questFixture(overrides: Partial<QuestRecord> = {}): QuestRecord {
  return {
    id: 1,
    spaceId: 1,
    spaceSlug: 'sandbox',
    spaceTitle: 'Sandbox',
    slug: 'onboarding',
    name: 'Onboarding matcher',
    goal: 'Match joiners',
    scopeIn: [],
    scopeOut: [],
    scopeInMarkdown: '',
    scopeOutMarkdown: '',
    successCriteria: '',
    rewards: [],
    status: 'proposed',
    targetDate: null,
    leadPersonId: 7,
    leadName: 'Ada Lovelace',
    leadAvatarUrl: null,
    creatorPersonId: 7,
    proposalDocumentId: 42,
    proposalSlug: 'quest-onboarding',
    proposalWeb3Id: 9,
    proposalStatus: 'onVoting',
    acceptedAt: null,
    chatRoomId: null,
    health: {
      state: 'on_track',
      marker: 50,
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
    members: [],
    deliverables: [],
    updates: [],
    latestUpdateLine: null,
    latestUpdateAt: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function overviewFor(quest: QuestRecord): SpaceQuestsOverview {
  return {
    spaceSlug: 'sandbox',
    spaceTitle: 'Sandbox',
    quests: [quest],
    counts: {
      active: 0,
      proposed: 1,
      paused: 0,
      completed: 0,
      rejected: 0,
      archived: 0,
      total: 1,
    },
  };
}

function DetailProbe() {
  const { quest, isLoading } = useSpaceQuestDetail('sandbox', 'onboarding');
  return (
    <div>
      <span data-testid="quest-loading">{String(isLoading)}</span>
      <span data-testid="quest-name">{quest?.name ?? ''}</span>
    </div>
  );
}

async function clearQuestCache() {
  await mutate(
    (key) => Array.isArray(key) && key[0] === SPACE_QUESTS_SWR_KEY,
    undefined,
    { revalidate: false },
  );
}

afterEach(async () => {
  cleanup();
  await clearQuestCache();
  vi.unstubAllGlobals();
});

describe('quest detail cache reuse', () => {
  it('paints the overview quest before the detail request resolves', async () => {
    const cached = questFixture();
    let resolveDetail: (quest: QuestRecord) => void = () => undefined;
    const detailGate = new Promise<QuestRecord>((resolve) => {
      resolveDetail = resolve;
    });
    let detailFetches = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/quests/onboarding')) {
          detailFetches += 1;
          const quest = await detailGate;
          return new Response(JSON.stringify(quest), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('not found', { status: 404 });
      }),
    );

    await mutate(
      spaceQuestOverviewKey('sandbox', 'user-1'),
      overviewFor(cached),
      {
        revalidate: false,
      },
    );

    const started = performance.now();
    render(
      <SWRConfig value={{ dedupingInterval: 0, revalidateOnFocus: false }}>
        <DetailProbe />
      </SWRConfig>,
    );
    const firstPaintMs = performance.now() - started;

    expect(screen.getByTestId('quest-name').textContent).toBe(
      'Onboarding matcher',
    );
    expect(screen.getByTestId('quest-loading').textContent).toBe('false');
    expect(firstPaintMs).toBeLessThan(50);

    resolveDetail(questFixture({ name: 'Onboarding matcher (fresh)' }));
    await waitFor(() => {
      expect(screen.getByTestId('quest-name').textContent).toBe(
        'Onboarding matcher (fresh)',
      );
    });
    expect(detailFetches).toBe(1);
  });

  it('stays loading when the overview cache is empty', async () => {
    let resolveDetail: (quest: QuestRecord) => void = () => undefined;
    const detailGate = new Promise<QuestRecord>((resolve) => {
      resolveDetail = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const quest = await detailGate;
        return new Response(JSON.stringify(quest), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    render(
      <SWRConfig
        value={{
          provider: () => new Map(),
          dedupingInterval: 0,
          revalidateOnFocus: false,
        }}
      >
        <DetailProbe />
      </SWRConfig>,
    );

    expect(screen.getByTestId('quest-name').textContent).toBe('');
    expect(screen.getByTestId('quest-loading').textContent).toBe('true');

    resolveDetail(questFixture());
    await waitFor(() => {
      expect(screen.getByTestId('quest-loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('quest-name').textContent).toBe(
      'Onboarding matcher',
    );
  });

  it('seeds an empty detail key and leaves a warmer record alone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Promise<Response>(() => undefined)),
    );

    await seedSpaceQuestDetailCache('sandbox', [questFixture()], 'user-1');
    const { unmount } = render(
      <SWRConfig value={{ dedupingInterval: 0, revalidateOnFocus: false }}>
        <DetailProbe />
      </SWRConfig>,
    );
    expect(screen.getByTestId('quest-name').textContent).toBe(
      'Onboarding matcher',
    );
    unmount();

    await mutate(
      spaceQuestDetailKey('sandbox', 'onboarding', 'user-1'),
      questFixture({ name: 'Edited on the quest page' }),
      { revalidate: false },
    );
    await seedSpaceQuestDetailCache(
      'sandbox',
      [questFixture({ name: 'Stale list copy' })],
      'user-1',
    );

    render(
      <SWRConfig value={{ dedupingInterval: 0, revalidateOnFocus: false }}>
        <DetailProbe />
      </SWRConfig>,
    );
    expect(screen.getByTestId('quest-name').textContent).toBe(
      'Edited on the quest page',
    );
  });
});
