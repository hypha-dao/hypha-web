import { describe, expect, it } from 'vitest';

import type { MemberHomeThreadItem } from '../member-home-thread';
import {
  balanceMemberHomeThread,
  movementKindForAgreement,
  selectMemberMovement,
} from '../member-situation';
import { signalTypesForOrientation } from '../network-horizon';

function item(
  overrides: Partial<MemberHomeThreadItem> &
    Pick<MemberHomeThreadItem, 'slug' | 'kind'>,
): MemberHomeThreadItem {
  return {
    title: overrides.slug,
    spaceSlug: 'grove',
    spaceTitle: 'Grove',
    action: overrides.kind === 'signal' ? 'validate' : 'decision',
    documentKind: overrides.kind,
    authoredByMember: false,
    category: null,
    summary: null,
    creatorId: null,
    creatorName: null,
    creatorAvatarUrl: null,
    ...overrides,
  };
}

describe('balanceMemberHomeThread', () => {
  const now = new Date('2026-10-11T00:00:00.000Z');

  it('keeps an overdue assigned signal ahead of a vote and caps the rest', () => {
    const signals = Array.from({ length: 6 }, (_, index) => ({
      slug: `fresh-${index}`,
      priority: 'low',
      assignedToMember: false,
      createdAt: '2026-10-10T00:00:00.000Z',
    }));
    const focused = balanceMemberHomeThread(
      [
        item({ slug: 'vote-1', kind: 'proposal', documentKind: 'proposal' }),
        item({ slug: 'vote-2', kind: 'proposal', documentKind: 'proposal' }),
        item({ slug: 'vote-3', kind: 'proposal', documentKind: 'proposal' }),
        item({ slug: 'late', kind: 'signal' }),
        ...signals.map((signal) => item({ slug: signal.slug, kind: 'signal' })),
        item({ slug: 'network-need', kind: 'signal' }),
      ],
      {
        signals: [
          ...signals,
          {
            slug: 'late',
            priority: 'low',
            assignedToMember: true,
            dueAt: '2026-10-01T00:00:00.000Z',
          },
        ],
        networkSignals: [{ slug: 'network-need' }],
      },
      now,
    );

    expect(focused[0]?.slug).toBe('late');
    expect(
      focused.filter((row) => row.documentKind === 'proposal'),
    ).toHaveLength(2);
    expect(focused.filter((row) => row.slug.startsWith('fresh-'))).toHaveLength(
      2,
    );
    expect(focused.map((row) => row.slug)).toContain('network-need');
    expect(focused.length).toBeLessThanOrEqual(8);
  });

  it('leaves the network out when their spaces already fill the home', () => {
    const own = [
      ...Array.from({ length: 2 }, (_, index) =>
        item({ slug: `late-${index}`, kind: 'signal' }),
      ),
      ...Array.from({ length: 2 }, (_, index) =>
        item({ slug: `high-${index}`, kind: 'signal' }),
      ),
      ...Array.from({ length: 2 }, (_, index) =>
        item({
          slug: `vote-${index}`,
          kind: 'proposal',
          documentKind: 'proposal',
        }),
      ),
      ...Array.from({ length: 2 }, (_, index) =>
        item({ slug: `new-${index}`, kind: 'signal' }),
      ),
    ];
    const focused = balanceMemberHomeThread(
      [...own, item({ slug: 'elsewhere', kind: 'signal' })],
      {
        signals: [
          ...Array.from({ length: 2 }, (_, index) => ({
            slug: `late-${index}`,
            priority: 'low',
            assignedToMember: true,
            dueAt: '2026-10-01T00:00:00.000Z',
          })),
          ...Array.from({ length: 2 }, (_, index) => ({
            slug: `high-${index}`,
            priority: 'high',
            assignedToMember: false,
          })),
          ...Array.from({ length: 2 }, (_, index) => ({
            slug: `new-${index}`,
            priority: 'low',
            assignedToMember: false,
            createdAt: '2026-10-10T00:00:00.000Z',
          })),
        ],
        networkSignals: [{ slug: 'elsewhere' }],
      },
      now,
    );
    expect(focused).toHaveLength(8);
    expect(focused.map((row) => row.slug)).not.toContain('elsewhere');
  });
});

describe('selectMemberMovement', () => {
  it('keeps one join, one treasury move, and one voice change', () => {
    const picked = selectMemberMovement([
      {
        id: 'join-1',
        kind: 'joined',
        title: 'Ada',
        spaceSlug: 'grove',
        spaceTitle: 'Grove',
        documentSlug: null,
        at: '2026-10-01T00:00:00.000Z',
      },
      {
        id: 'join-2',
        kind: 'joined',
        title: 'Noor',
        spaceSlug: 'grove',
        spaceTitle: 'Grove',
        documentSlug: null,
        at: '2026-10-09T00:00:00.000Z',
      },
      {
        id: 'pay-1',
        kind: 'treasury',
        title: 'Pay the nursery',
        spaceSlug: 'grove',
        spaceTitle: 'Grove',
        documentSlug: 'pay',
        at: '2026-10-08T00:00:00.000Z',
      },
      {
        id: 'voice-1',
        kind: 'voice',
        title: 'Grow voice',
        spaceSlug: 'grove',
        spaceTitle: 'Grove',
        documentSlug: 'voice',
        at: '2026-10-07T00:00:00.000Z',
      },
    ]);
    expect(picked.map((row) => row.id)).toEqual(['join-2', 'pay-1', 'voice-1']);
  });
});

describe('movementKindForAgreement', () => {
  it('reads voice, treasury, and a welcome from the record', () => {
    expect(
      movementKindForAgreement({
        label: 'Governance',
        voting: true,
        tokenType: null,
      }),
    ).toBe('voice');
    expect(
      movementKindForAgreement({
        label: 'Pay for expenses',
        voting: false,
        tokenType: null,
      }),
    ).toBe('treasury');
    expect(
      movementKindForAgreement({
        label: 'Invite Member',
        voting: false,
        tokenType: null,
      }),
    ).toBe('joined');
  });
});

describe('signalTypesForOrientation', () => {
  it('keeps each way of showing up on its own signals', () => {
    expect(signalTypesForOrientation('member')).toEqual([
      'Need',
      'Resource',
      'Action',
    ]);
    expect(signalTypesForOrientation('builder')).toEqual([
      'Opportunity',
      'Insight',
    ]);
    expect(signalTypesForOrientation('investor')).toEqual(['Impact']);
    const member = new Set(signalTypesForOrientation('member'));
    for (const type of signalTypesForOrientation('builder')) {
      expect(member.has(type)).toBe(false);
    }
    for (const type of signalTypesForOrientation('investor')) {
      expect(member.has(type)).toBe(false);
    }
  });
});
