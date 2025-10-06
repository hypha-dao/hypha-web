import {
  ProposalsListResponse,
  ProposalDetailsResponse,
  ProposalVotesResponse,
  VoteResponse,
  ProposalSummary,
} from '../types/v1/generated';

export const proposalsListMock: ProposalsListResponse = {
  data: [
    {
      id: 1,
      title: 'DAO Funding Proposal',
      type: ProposalSummary.type.AGREEMENT,
      image_url: 'https://example.com/proposal1.png',
      status: ProposalSummary.status.ACTIVE,
      unity: 80,
      quorum: 60,
      user_vote: ProposalSummary.user_vote.YES,
      voting_deadline: '2023-12-01T12:00:00Z',
      author: {
        username: 'alice',
        reference: 'user-1',
        avatar_url: 'https://example.com/alice.png',
      },
    },
    {
      id: 2,
      title: 'Recurring Payment Proposal',
      type: ProposalSummary.type.CONTRIBUTION,
      image_url: 'https://example.com/proposal2.png',
      status: ProposalSummary.status.PAST,
      unity: 70,
      quorum: 50,
      user_vote: ProposalSummary.user_vote.NO,
      voting_deadline: '2023-11-01T12:00:00Z',
      author: {
        username: 'bob',
        reference: 'user-2',
        avatar_url: 'https://example.com/bob.png',
      },
    },
  ],
  meta: {
    total: 2,
    limit: 10,
    offset: 0,
  },
};

export const proposalDetailsMock: ProposalDetailsResponse = {
  id: 1,
  title: 'DAO Funding Proposal',
  details: 'Proposal to fund the DAO treasury for Q1 operations.',
  image_url: 'https://example.com/proposal1.png',
  type: ProposalDetailsResponse.type.ONE_TIME_PAYMENT,
  state: ProposalDetailsResponse.state.ACTIVE,
  dao: 'Hypha DAO',
  commitment: ProposalDetailsResponse.commitment.ONE_TIME,
  unity: 80,
  quorum: 60,
  past_unity: 75,
  past_quorum: 55,
  voting_deadline: '2023-12-01T12:00:00Z',
  user_vote: ProposalDetailsResponse.user_vote.YES,
  creator: {
    username: 'alice',
    address: '0x1234567890abcdef',
    avatar_url: 'https://example.com/alice.png',
  },
  total_votes: 100,
  votes: [
    { username: 'alice', avatar_url: 'https://example.com/alice.png' },
    { username: 'bob', avatar_url: 'https://example.com/bob.png' },
  ],
  start_date: '2023-11-01T12:00:00Z',
  duration_weeks: 4,
  tokens: [
    { name: 'HYP', amount_per_week: 100 },
    { name: 'VOICE', amount_per_week: 50 },
  ],
};

export const proposalVotesMock: ProposalVotesResponse = {
  proposal_id: 1,
  unity: 80,
  quorum: 60,
  total_votes: 100,
  votes: [
    {
      username: 'alice',
      avatar_url: 'https://example.com/alice.png',
      vote: 'yes',
      voted_time: '2023-11-10T10:00:00Z',
    },
    {
      username: 'bob',
      avatar_url: 'https://example.com/bob.png',
      vote: 'no',
      voted_time: '2023-11-10T11:00:00Z',
    },
    {
      username: 'john',
      avatar_url: 'https://example.com/john.png',
      vote: 'yes',
      voted_time: '2023-11-10T12:00:00Z',
    },
  ],
};

export const voteMock: VoteResponse = {
  message: 'Vote submitted successfully',
  proposal_id: 1,
  user_vote: VoteResponse.user_vote.YES,
  voted_time: '2023-11-10T10:00:00Z',
};
