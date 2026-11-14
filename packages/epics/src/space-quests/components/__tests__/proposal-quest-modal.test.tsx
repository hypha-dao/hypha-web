// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildQuestProposalDescription } from '@hypha-platform/core/client';
import {
  ProposalQuestData,
  ProposalQuestOverviewLink,
} from '../proposal-quest-data';

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/dho/hypha/agreements/proposal/quest',
}));

vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    getAccessToken: async () => 'token',
    user: { id: 'user-1' },
    isLoading: false,
  }),
}));

const seedSpaceQuestDetailCache = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/use-space-quests', () => ({
  useSpaceQuests: () => ({
    overview: {
      quests: [
        {
          slug: 'onboarding-matcher',
          proposalDocumentId: 42,
        },
      ],
    },
  }),
  seedSpaceQuestDetailCache: (...args: unknown[]) =>
    seedSpaceQuestDetailCache(...args),
}));

afterEach(() => {
  cleanup();
  seedSpaceQuestDetailCache.mockClear();
});

const description = buildQuestProposalDescription(
  {
    name: 'Onboarding matcher',
    goal: 'Match every new joiner to **3 spaces** in their first day.',
    scopeIn: ['Interest survey'],
    scopeOut: ['Paid placements'],
    successCriteria: '60% join a suggested space in 7 days',
    rewards: [{ amount: '2,500', token: 'USDC' }],
    targetDate: '20 November 2026',
    leadName: 'Ada Lovelace',
    milestones: [
      {
        name: 'Run check one',
        description: 'Record the pass',
        dueDate: '20 November 2026',
        ownerName: 'Ada Lovelace',
      },
    ],
    members: [
      {
        memberName: 'Ada Lovelace',
        roleLabel: 'Lead',
        responsibilities: ['Own the checklist'],
      },
    ],
  },
  'onboarding-matcher',
);

describe('quest proposal modal body', () => {
  it('shows only the goal and keeps the quest page link', () => {
    render(
      <>
        <ProposalQuestOverviewLink
          spaceSlug="hypha"
          documentId={42}
          content={description}
        />
        <ProposalQuestData title="Onboarding matcher" content={description} />
      </>,
    );

    expect(screen.getByRole('heading', { name: 'Goal' }).textContent).toBe(
      'Goal',
    );
    expect(screen.getByText('3 spaces')?.tagName).toBe('STRONG');
    expect(document.body.textContent).toContain('Match every new joiner to');
    expect(document.body.textContent).not.toContain('Interest survey');
    expect(document.body.textContent).not.toContain('Paid placements');
    expect(document.body.textContent).not.toContain('60%');
    expect(document.body.textContent).not.toContain('Run check one');
    expect(document.body.textContent).not.toContain('Ada Lovelace');
    expect(document.body.textContent).not.toContain('USDC');
    expect(document.body.textContent).not.toContain('2,500');
    expect(document.body.textContent).not.toContain('Own the checklist');

    const link = screen.getByRole('link', { name: /view quest overview/i });
    expect(link.getAttribute('href')).toBe(
      '/en/dho/hypha/quests/onboarding-matcher',
    );
    expect(seedSpaceQuestDetailCache).toHaveBeenCalledWith(
      'hypha',
      [expect.objectContaining({ slug: 'onboarding-matcher' })],
      'user-1',
    );
    expect(
      screen
        .getByTestId('quest-proposal-structured-body')
        .querySelector('.max-h-64.overflow-y-auto'),
    ).not.toBeNull();
    expect(screen.queryByRole('button', { name: /accept|reject|vote/i })).toBe(
      null,
    );
  });

  it('renders nothing when the goal is empty, including the summary fallback', () => {
    const emptyGoal = buildQuestProposalDescription(
      {
        name: 'Onboarding matcher',
        goal: '<p><br></p>',
        scopeIn: ['Interest survey'],
        scopeOut: [],
        successCriteria: '60% join',
        rewards: [{ amount: '2,500', token: 'USDC' }],
        targetDate: null,
        leadName: 'Ada Lovelace',
        milestones: [],
        members: [],
      },
      'onboarding-matcher',
    );
    const { container } = render(
      <ProposalQuestData title="Onboarding matcher" content={emptyGoal} />,
    );
    expect(container.textContent?.trim() ?? '').toBe('');
    expect(container.textContent).not.toContain('Quest proposal for');
    expect(container.textContent).not.toContain('Interest survey');
    expect(container.textContent).not.toContain('Not set yet');
  });

  it('leaves proposal voting wired in the shared proposal panel', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../proposals/components/proposal-detail.tsx',
      ),
      'utf8',
    );
    expect(source).toContain('<FormVoting');
    expect(source).toContain('onAccept={handleAccept}');
    expect(source).toContain('onReject={handleReject}');
    expect(source).toContain('<ProposalQuestData');
    expect(source).toContain('<ProposalQuestOverviewLink');
    expect(source.indexOf('<ProposalQuestOverviewLink')).toBeGreaterThan(
      source.indexOf('<ProposalQuestData'),
    );
    expect(source).not.toContain('QUEST REWARD');
    expect(source).not.toContain('showMilestones');
  });

  it('prefetches the quest page and keeps edit modals off the first chunk', () => {
    const linkSource = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../proposal-quest-data.tsx',
      ),
      'utf8',
    );
    expect(linkSource).toContain('prefetch={true}');
    expect(linkSource).toContain('router.prefetch(href)');
    expect(linkSource).toContain('if (isModifiedClick(event)) return');
    expect(linkSource).toContain('setPending(true)');

    const detailSource = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../space-quest-detail.tsx',
      ),
      'utf8',
    );
    expect(detailSource).toContain("import dynamic from 'next/dynamic'");
    expect(detailSource).not.toMatch(
      /import \{[^}]*EditQuestNameModal[^}]*\} from '\.\/quest-section-edit-modals'/,
    );
    expect(detailSource).not.toContain("from './space-quests-section'");

    const loadingSource = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../../../../apps/web/src/app/(main)/[lang]/dho/[id]/@tab/quests/[questSlug]/loading.tsx',
      ),
      'utf8',
    );
    expect(loadingSource).toContain('layout="quests"');

    const asideLoadingSource = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../../../../apps/web/src/app/(main)/[lang]/dho/[id]/@aside/quests/[questSlug]/loading.tsx',
      ),
      'utf8',
    );
    expect(asideLoadingSource).toContain('return null');
    expect(detailSource).toContain('prefetch={false}');
    expect(detailSource).toContain("editingModal === 'name' ? (");
  });
});
