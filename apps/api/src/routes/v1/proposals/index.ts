import type { FastifyInstance } from 'fastify';
import type { State } from '@schemas/proposal';
import { schema, type Schema } from './schema';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@plugins/web3-abi';

export default async function proposalsRoutes(app: FastifyInstance) {
  app.get<Schema>('/', { schema }, async (request) => {
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

    const dbData = await app.db.findAllDocumentsBySpaceId({
      id: dao_id,
      filter: {},
      pagination: { offset, pageSize: limit },
    });

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

      const missingWeb3Id = dbData.data.find(
        ({ web3ProposalId }) => web3ProposalId === null,
      );
      if (missingWeb3Id) {
        console.error(
          'Missing proposal web3Id in',
          missingWeb3Id.id,
          'proposal',
        );

        return;
      }

      try {
        return await client.multicall({
          allowFailure: false,
          contracts: dbData.data.map(({ web3ProposalId }) => ({
            address: contractAddress,
            abi: daoProposalsImplementationAbi,
            functionName: 'getProposalCore',
            args: [BigInt(web3ProposalId as number)],
          })),
        });
      } catch (e) {
        console.error('Error fetching proposal details:', e);
      }
    })();
    if (!web3Data || web3Data.length !== dbData.data.length) {
      // TODO: implement proper return
      throw new Error('Internal server error');
    }

    const proposalWeb3Details = web3Data.map((details) => {
      const [
        _spaceId,
        _startTime,
        endTime,
        executed,
        expired,
        yesVotes,
        noVotes,
        totalVotingPowerAtSnapshot,
        _creator,
        _transactions,
      ] = details as readonly [
        bigint,
        bigint,
        bigint,
        boolean,
        boolean,
        bigint,
        bigint,
        bigint,
        `0x${string}`,
        readonly object[],
      ];

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

      const status: State = executed || expired ? 'past' : 'active';

      return {
        deadline: new Date(Number(endTime) * 1000),
        unity,
        quorum,
        status,
      };
    });

    return {
      data: dbData.data.map((data, index) => ({
        id: data.id,
        title: data.title,
        description: data.description || '',
        label: 'agreement',
        image_URL: data.leadImage || '',
        state: proposalWeb3Details[index]!.status,
        unity: proposalWeb3Details[index]!.unity,
        quorum: proposalWeb3Details[index]!.quorum,
        user_vote: null,
        voting_deadline: proposalWeb3Details[index]!.deadline.toISOString(),
        creatorId: data.creatorId,
        creator: {
          name: data.creator?.name || '',
          surname: data.creator?.surname || '',
          avatarUrl: data.creator?.avatarUrl || '',
        },
        createdAt: data.createdAt.toISOString(),
        updatedAt: data.updatedAt.toISOString(),
      })),
      meta: {
        limit,
        offset,
        total: dbData.pagination.total,
      },
    };
  });

  app.post('/', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });
}
