import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';

export default async function route(app: FastifyInstance) {
  app.get<Schema>('/', { schema }, async (request) => {
    const { id } = request.params;
    const token = await app.db.findTokenById({ id });
    if (token == null) {
      // TODO: implement proper return
      throw new Error('Token not found');
    }
    if (token.address == null) {
      // TODO: implement proper return
      throw new Error('Token does not have an address');
    }

    // TODO: get recipients
  });
}
