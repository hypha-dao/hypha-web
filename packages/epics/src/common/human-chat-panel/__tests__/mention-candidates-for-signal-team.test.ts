import { describe, expect, it } from 'vitest';

import { mentionCandidatesForSignalTeam } from '../build-space-roster-mention-candidates';

describe('mentionCandidatesForSignalTeam', () => {
  it('keeps team members the space roster has not mapped', () => {
    const roster = [
      {
        userId: '@vlad:example.org',
        displayLabel: 'Vlad Hramtsov',
      },
    ];
    const team = mentionCandidatesForSignalTeam({
      roster,
      teamMemberIds: [
        '@vlad:example.org',
        '@gerardo:example.org',
        '@me:example.org',
      ],
      currentUserId: '@me:example.org',
      labelFor: (userId) =>
        userId === '@gerardo:example.org' ? 'Gerardo Roza' : userId,
    });

    expect(team.map((candidate) => candidate.displayLabel)).toEqual([
      'Gerardo Roza',
      'Vlad Hramtsov',
    ]);
  });
});
