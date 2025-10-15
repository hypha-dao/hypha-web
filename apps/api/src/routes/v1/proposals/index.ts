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
import type { Summary } from './schema';
import { db } from '@hypha-platform/storage-postgres';
import { findAllDocumentsBySpaceId } from '@hypha-platform/core/server';

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
      const { dao_id, limit, offset } = request.query;
      const status = request.query.status ?? 'all';

      if (dao_id === undefined) {
        return reply.send({ data: [], meta: { total: 0, limit, offset } });
      }

      const res = await findAllDocumentsBySpaceId(
        { id: dao_id },
        {
          db,
          pagination: {
            pageSize: limit,
            offset,
          },
          filter: { status },
        },
      );

      const data: Summary[] = res.data.map((doc) => ({
        id: doc.id,
        title: doc.title,
        type: 'agreement',
        image_url: doc.leadImage || '',
        status,
        unity: 0,
        quorum: 0,
        user_vote: null,
        voting_deadline: new Date(doc.updatedAt ?? doc.createdAt).toISOString(),
        author: {
          username: doc.creator?.name || 'unknown',
          reference: String(doc.creatorId ?? doc.id),
          avatar_url: doc.creator?.avatarUrl || '',
        },
      }));

      return reply.send({
        data,
        meta: { total: res.pagination.total, limit, offset },
      });
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
