import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SendTokenRequest } from '../../types/v1/generated';
import {
  receiveTokenMock,
  sendTokenMock,
  recipientsMock,
  tokenBalanceMock,
  walletBalancesMock,
} from '../../mocks';

export default async function walletRoutes(app: FastifyInstance) {
  /**
   * GET /wallet/receive
   */
  app.get('/receive', async (request, reply) => {
    const params = z.object({
      token_id: z.coerce.number().int().nonnegative(),
      network: z.string().default('base'),
    });
    const { token_id, network } = params.parse(request.query);

    return reply.send({ ...receiveTokenMock, token_id, network });
  });

  /**
   * POST /wallet/send
   */
  app.post('/send', async (request, reply) => {
    const requestBody = z.object({
      token_id: z.number().int().nonnegative(),
      dao_id: z.number().int().nonnegative(),
      amount: z.number().nonnegative(),
      recipient_key: z.string(),
      memo: z.string(),
      network_fee: z.number().nonnegative().default(0),
    });
    const params: SendTokenRequest = requestBody.parse(request.body);
    console.debug('POST /wallet/send:', params);

    return reply.send(sendTokenMock);
  });

  /**
   * GET /wallet/recipients
   */
  app.get('/recipients', async (request, reply) => {
    const params = z.object({
      token: z.coerce.number().int().nonnegative(),
      limit: z.coerce.number().int().nonnegative().default(20),
      offset: z.coerce.number().int().nonnegative().default(0),
    });
    const { limit, offset } = params.parse(request.query);
    const paginated = (recipientsMock.recipients ?? []).slice(
      offset,
      offset + limit,
    );

    return reply.send({ recipients: paginated });
  });

  /**
   * GET /wallet/tokens/:id
   */
  app.get('/tokens/:id', async (request, reply) => {
    const searchParams = z.object({
      limit: z.coerce.number().int().nonnegative().default(20),
      offset: z.coerce.number().int().nonnegative().default(0),
    });

    const { id } = z
      .object({ id: z.coerce.number().int().nonnegative() })
      .parse(request.params);
    console.debug(`GET /tokens/${id}`);

    const { offset, limit } = searchParams.parse(request.query);
    const paginated = (tokenBalanceMock.transactions ?? []).slice(
      offset,
      offset + limit,
    );

    return reply.send({ ...tokenBalanceMock, transactions: paginated });
  });

  /**
   * GET /wallet
   */
  app.get('/', async (_, reply) => {
    return reply.send(walletBalancesMock);
  });
}
