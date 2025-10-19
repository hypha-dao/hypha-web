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
import { newDbClient } from '../../../plugins/db-client';
import { findAllDocumentsBySpaceId } from '../../../plugins/db-queries';
import { type Environment } from '../../../schemas/';

export default async function proposalsRoutes(app: FastifyInstance) {
  const {
    DEFAULT_DB_URL,
    DEFAULT_DB_ANONYMOUS_URL,
    DEFAULT_DB_AUTHENTICATED_URL,
  } = app.getEnvs<Environment>();
  const dbUrl =
    DEFAULT_DB_URL || DEFAULT_DB_ANONYMOUS_URL || DEFAULT_DB_AUTHENTICATED_URL;
  if (dbUrl == null)
    throw Error(
      'DB connection url is not set ' +
        '(DEFAULT_DB_URL, DEFAULT_DB_ANONYMOUS_URL, DEFAULT_DB_AUTHENTICATED_URL)',
    );
  const db = newDbClient(dbUrl);

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
    async (request, _) => {
      const { limit, offset, dao_id } = request.query;

      if (!dao_id) {
        // TODO: implement fetching latest proposals
        return {
          data: [],
          meta: {
            limit: 0,
            offset: 0,
            total: 0,
          },
        };
      }

      const res = await findAllDocumentsBySpaceId(
        { id: dao_id },
        {
          db,
          filter: {},
          pagination: { offset, pageSize: limit },
        },
      );

      return {
        data: res.data.map((data) => ({
          id: data.id,
          title: data.title,
          type: 'agreement',
          image_url: data.leadImage || '',
          status: 'active',
          unity: 0,
          quorum: 0,
          user_vote: null,
          voting_deadline: '',
          author: {
            username: data.creator?.name || '',
            reference: '',
            avatar_url: data.creator?.avatarUrl || '',
          },
        })),
        meta: {
          limit,
          offset,
          total: res.pagination.total,
        },
      };
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
      title: `Proposal #${params.id} `,
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
