import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@plugins/web3-abi';

export default async function spacesIdRoutes(app: FastifyInstance) {
  /**
   * @summary Get details of a space by its ID
   */
  app.get<Schema>('/', { schema }, async (request, reply) => {
    const { id } = request.params;

    const [dbData] = await app.db.findSpaceByIds({ ids: [id] });
    if (dbData == null) return reply.notFound('Space not found');

    const result = {
      id: dbData.id,
      name: dbData.title,
      description: dbData.description,
      cover_image_url: dbData.leadImage,
      icon_url: dbData.logoUrl,
      members_count: 0,
      proposals_count: 0,
    };

    const { web3SpaceId } = dbData;
    if (web3SpaceId == null) {
      app.log.warn(`Space ${id} does not have web3 ID`);

      return result;
    }

    const web3Id = BigInt(web3SpaceId);
    const spaceFactoryAddress = daoSpaceFactoryImplementationAddress[8453];
    const proposalsAddress = daoProposalsImplementationAddress[8453];

    const [details, proposals] = await app.web3Client.multicall({
      contracts: [
        {
          address: spaceFactoryAddress,
          abi: daoSpaceFactoryImplementationAbi,
          functionName: 'getSpaceDetails',
          args: [web3Id],
        },
        {
          address: proposalsAddress,
          abi: daoProposalsImplementationAbi,
          functionName: 'getSpaceProposals',
          args: [web3Id],
        },
      ],
    });
    if (details.status !== 'success') {
      app.log.error({
        message: `Failed to get space ${id} details`,
        error: details.error,
      });
    }
    if (proposals.status !== 'success') {
      app.log.error({
        message: `Failed to get space ${id} proposals`,
        error: proposals.error,
      });
    }

    // Counting only accepted ones
    const [accepted = []] = proposals.result ?? [];
    const [_unity, _quorum, _votingPowerSource, _tokenAddresses, members] =
      details.result ?? [];

    return {
      ...result,
      members_count: members?.length ?? 0,
      proposals_count: accepted.length,
    };
  });
}
