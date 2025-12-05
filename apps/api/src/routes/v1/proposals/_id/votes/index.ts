import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@plugins/web3-abi';

export default async function votesRoutes(app: FastifyInstance) {
  app.get<Schema>('/', { schema }, async (request, reply) => {
    const { id } = request.params;
    const { limit, offset } = request.query;

    const web3Id = await app.db.findDocumentWeb3Id({ id });
    if (web3Id == null) return reply.notFound('Document not found');

    const web3Data = await (async () => {
      const client = app.web3Client;

      // TODO: use a proper default
      const chainId = client.chain?.id || 8453;
      type ChainId = keyof typeof daoProposalsImplementationAddress;
      const contractAddress =
        chainId in daoProposalsImplementationAddress &&
        daoProposalsImplementationAddress[chainId as ChainId];
      if (!contractAddress) {
        console.error('Contract address was not found');

        return;
      }

      try {
        return await client.readContract({
          address: contractAddress,
          abi: daoProposalsImplementationAbi,
          functionName: 'getProposalVoters',
          args: [BigInt(web3Id)],
        });
      } catch (e) {
        console.error('Error fetching proposal details:', e);
      }
    })();
    if (!web3Data) return reply.internalServerError();

    const [yesVoters, noVoters] = web3Data;

    const addresses = yesVoters.concat(noVoters);
    const people = app.db.peopleByAddresses({
      addresses,
      pagination: { pageSize: limit, offset },
    });

    const votes = new Map<string, 'yes' | 'no'>();
    yesVoters.forEach((addr) => votes.set(addr.toLowerCase(), 'yes'));
    noVoters.forEach((addr) => votes.set(addr.toLowerCase(), 'no'));

    const { data, meta } = await people;

    const voters = data.map((person) => ({
      name: person.name || '',
      surname: person.surname || '',
      avatarUrl: person.avatarUrl,
      address: person.address || '',
      vote: votes.get(person.address?.toLowerCase() ?? '') || null,
      timestamp: null,
    }));

    return { voters, meta };
  });
}
