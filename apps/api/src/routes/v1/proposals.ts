import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CreateProposalRequest,
  ProposalDetailsResponse,
  ProposalsListResponse,
  ProposalSummary,
  ProposalVotesResponse,
  VoteRequest,
  VoteResponse
} from '../../types/v1/generated';

const mockProposal: ProposalSummary = {
  id: 1,
  title: 'Sample Proposal',
  type: ProposalSummary.type.ONE_TIME_PAYMENT,
  image_url: 'https://example.com/image.jpg',
  status: ProposalSummary.status.ACTIVE,
  unity: 70,
  quorum: 50,
  user_vote: ProposalSummary.user_vote.YES,
  voting_deadline: new Date().toISOString(),
  author: {
    username: 'john_doe',
    reference: '0x123',
    avatar_url: 'https://example.com/avatar.jpg',
  },
};

export default async function proposalsRoutes(app: FastifyInstance) {
  /**
   * GET /proposals
   */
  app.get('/', async (request, reply) => {
    const mockResponse: ProposalsListResponse = {
      data: [mockProposal],
      meta: {
        total: 1,
        limit: 20,
        offset: 0,
      },
    };

    return reply.send(mockResponse);
  });

  /**
   * POST /proposals
   */
  app.post('/', async (request, reply) => {
    const body = request.body as CreateProposalRequest;

    const mockResponse: ProposalDetailsResponse = {
      ...mockProposal,
      id: 2,
      title: body.title,
      details: body.details,
    };

    return reply.send(mockResponse);
  });

  /**
   * GET /proposals/:id
   */
  app.get('/:id', async (request, reply) => {
    const params = z.object({ id: z.coerce.number() }).parse(request.params);

    const mockResponse: ProposalDetailsResponse = {
      ...mockProposal,
      id: params.id,
      title: `Proposal #${params.id}`,
      details: 'This is a detailed description of the proposal.',
    };

    return reply.send(mockResponse);
  });

  /**
   * GET /proposals/:id/votes
   */
  app.get('/:id/votes', async (request, reply) => {
    const params = z.object({ id: z.coerce.number() }).parse(request.params);

    const mockResponse: ProposalVotesResponse = {
      proposal_id: params.id,
      votes: [
        { username: 'john', vote: "yes" },
        { username: 'jane', vote: "no" },
        { username: 'doe', vote: "viewed" },
      ],
    };

    return reply.send(mockResponse);
  });

  /**
   * POST /proposals/:id/vote
   */
  app.post('/:id/vote', async (request, reply) => {
    const params = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = request.body as VoteRequest;

    const mockResponse: VoteResponse = {
      message: 'Vote recorded successfully',
      proposal_id: params.id,
      user_vote: body.vote as unknown as VoteResponse.user_vote
    };

    return reply.send(mockResponse);
  });

}