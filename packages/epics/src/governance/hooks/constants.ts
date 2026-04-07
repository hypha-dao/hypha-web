export const VOTING_METHOD_TEMPLATES = [
  { title: '80-20 Pareto', titleKey: 'pareto8020', quorum: 20, unity: 80 },
  { title: 'Majority Vote', titleKey: 'majorityVote', quorum: 51, unity: 51 },
  { title: 'Minority Vote', titleKey: 'minorityVote', quorum: 10, unity: 90 },
  { title: 'Consensus', titleKey: 'consensus', quorum: 100, unity: 100 },
  { title: 'Consent', titleKey: 'consent', quorum: 0, unity: 100 },
  { title: 'Hearing', titleKey: 'hearing', quorum: 100, unity: 0 },
];

export const VOTING_METHOD_TYPES = {
  1: '1t1v',
  2: '1m1v',
  3: '1v1v',
};
