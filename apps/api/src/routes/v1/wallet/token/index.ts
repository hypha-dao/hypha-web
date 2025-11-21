import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';

export default async function tokenRoutes(app: FastifyInstance) {
  /**
   * @summary Fetches transactions of a user by specified token
   */
  app.get<Schema>('/:id', { schema }, async (req) => {
    const authToken = req.headers.authorization?.split(' ').at(1);
    // TODO: implement proper return
    if (authToken == null) throw new Error('Unauthorized');

    const userAddress = (await app.db.findPersonByAuth({ authToken }))?.address;
    // TODO: implement proper return
    if (userAddress == null) throw new Error('User not found');

    const { id } = req.params;
    const token = await app.db.findTokenById({ id });
    // TODO: implement proper return
    if (token == null) throw new Error('Token not found');
  });
}
