import { describe, expect, it } from 'vitest';

import { mentionCandidateMatchRank } from '../human-chat-mention-search';

const member = {
  userId: '@prod_privy_did_privy_cmabc123:hs',
  displayLabel: 'Marieke Visser',
  nickname: 'marie',
  slug: 'marieke',
};

describe('mentionCandidateMatchRank', () => {
  it('matches display name, nickname, and username', () => {
    expect(mentionCandidateMatchRank(member, 'Marieke')).toBe('start');
    expect(mentionCandidateMatchRank(member, 'visser')).toBe('start');
    expect(mentionCandidateMatchRank(member, 'marie')).toBe('start');
    expect(mentionCandidateMatchRank(member, 'marieke')).toBe('start');
  });

  it('does not match an unrelated query', () => {
    expect(mentionCandidateMatchRank(member, 'Kate')).toBeNull();
  });
});
