import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';

export default async function receiveRoutes(app: FastifyInstance) {
  app.get<Schema>('/', { schema }, async (request, reply) => {
    const authToken = request.headers.authorization?.split(' ').at(1);
    if (authToken == null) return reply.unauthorized();

    const userAddress = (await app.db.findPersonByAuth({ authToken }))?.address;
    if (!userAddress) return reply.notFound('User not found');

    const { chain, tokenId } = request.query;
    if (tokenId != null) {
      // TODO: check if user can receive the token
    }

    return {
      network: chain,
      address: userAddress,
      qr_code_url: `ethereum:${userAddress}`,
    };
  });
}
