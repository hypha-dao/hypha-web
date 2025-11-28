import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';

export default async function receiveRoutes(app: FastifyInstance) {
  app.get<Schema>('/', { schema }, async (request) => {
    const authToken = request.headers.authorization?.split(' ').at(1);
    // TODO: implement proper return
    if (authToken == null) throw new Error('Unauthorized');

    const userAddress = (await app.db.findPersonByAuth({ authToken }))?.address;
    // TODO: implement proper return
    if (!userAddress) throw new Error('User not found');

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
