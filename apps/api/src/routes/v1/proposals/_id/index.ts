import type { FastifyInstance } from 'fastify';
import type { State } from '@schemas/proposal';
import { schema, type Schema } from './schema';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@plugins/web3-abi';

export default async function idRoutes(app: FastifyInstance) {
  app.get<Schema>('/', { schema }, async (request) => {
    const { id } = request.params;

    const dbData = await app.db.findDocumentById({ id });
    if (!dbData) {
      // TODO: implement proper return
      throw Error('Proposal does not exist');
    }

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

      const web3Id = dbData.web3ProposalId;
      if (!web3Id) {
        console.error('Missing proposal web3Id for', id, 'proposal');

        return;
      }

      try {
        return await client.readContract({
          address: contractAddress,
          abi: daoProposalsImplementationAbi,
          functionName: 'getProposalCore',
          args: [BigInt(web3Id)],
        });
      } catch (e) {
        console.error('Error fetching proposal details:', e);
      }
    })();
    if (!web3Data) {
      // TODO: implement proper return
      throw new Error('Internal server error');
    }

    const [
      _spaceId,
      _startTime,
      endTime,
      executed,
      expired,
      yesVotes,
      noVotes,
      totalVotingPowerAtSnapshot,
    ] = web3Data;

    const quorumTotalVotingPowerNumber = Number(totalVotingPowerAtSnapshot);
    const quorum =
      quorumTotalVotingPowerNumber > 0
        ? (Number(yesVotes + noVotes) / quorumTotalVotingPowerNumber) * 100
        : 0;

    const unityTotalVotingPowerNumber = Number(yesVotes) + Number(noVotes);
    const unity =
      unityTotalVotingPowerNumber > 0
        ? (Number(yesVotes) / unityTotalVotingPowerNumber) * 100
        : 0;

    const state: State = executed || expired ? 'past' : 'active';

    const web3ProposalDetails = {
      voting_deadline: new Date(Number(endTime) * 1000),
      unity,
      quorum,
      state,
    };

    return {
      ...web3ProposalDetails,
      id: dbData.id,
      title: dbData.title,
      description: dbData.description || '',
      label: 'agreement',
      image_URL: dbData.leadImage || '',
      user_vote: null,
      voting_deadline: web3ProposalDetails.voting_deadline.toISOString(),
      commitment: undefined,
      payments: [],
      creatorId: dbData.creatorId,
      creator: {
        name: dbData.creator?.name || '',
        surname: dbData.creator?.surname || '',
        avatarUrl: dbData.creator?.avatarUrl || '',
      },
      createdAt: dbData.createdAt.toISOString(),
      updatedAt: dbData.updatedAt.toISOString(),
    };
  });
}
