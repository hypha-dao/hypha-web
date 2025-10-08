import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CreateProposalRequest,
  VoteRequest,
} from '../../../types/v1/generated';
import {
  proposalsListMock,
  proposalDetailsMock,
  proposalVotesMock,
  voteMock,
} from '../../../mocks';
import { response, Response, query, Query } from './schema/get-proposals/';

export default async function proposalsRoutes(app: FastifyInstance) {
  /**
   * GET /proposals
   */
  app.get<{ Reply: Response; Querystring: Query }>(
    '/',
    {
      schema: {
        querystring: query,
        response: { '2xx': response },
      },
    },
    async (request, reply) => {
      return reply.send(proposalsListMock);
    },
  );

  /**
   * POST /proposals
   */
  app.post('/', async (request, reply) => {
    const body = request.body as CreateProposalRequest;

    const mockResponse = {
      ...proposalDetailsMock,
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

    const mockResponse = {
      ...proposalDetailsMock,
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

    const mockResponse = {
      ...proposalVotesMock,
      proposal_id: params.id,
    };

    return reply.send(mockResponse);
  });

  /**
   * POST /proposals/:id/vote
   */
  app.post('/:id/vote', async (request, reply) => {
    const params = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = request.body as VoteRequest;

    const mockResponse = {
      ...voteMock,
      user_vote: body.vote,
      proposal_id: params.id,
    };

    return reply.send(mockResponse);
  });
}
