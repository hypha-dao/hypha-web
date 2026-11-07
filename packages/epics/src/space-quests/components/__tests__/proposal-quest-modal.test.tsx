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
}));

afterEach(() => {
  cleanup();
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
    expect(source).not.toContain('QUEST REWARD');
    expect(source).not.toContain('showMilestones');
  });
});
