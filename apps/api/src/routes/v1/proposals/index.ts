import { FastifyInstance } from 'fastify';
import { response, Response, query, Query } from './schema/get-proposals/';
import {
  response as proposalIdResponse,
  type Response as ProposalIdResponse,
  params as proposalIdParams,
  type Params as ProposalIdParams,
} from './schema/get-proposals-id';
import {
  response as getProposalVotersResponse,
  params as getProposalVotersParams,
  query as getProposalVotersQuery,
  Response as GetProposalVotersResponse,
  Params as GetProposalVotersParams,
  Query as GetProposalVotersQuery,
} from './schema/get-proposals-id-voters';
import type { State } from '@schemas/proposal';
import { newDbClient } from '@plugins/db-client';
import {
  findAllDocumentsBySpaceId,
  findDocumentById,
  peopleByAddresses,
  findDocumentWeb3Id,
} from '@plugins/db-queries';
import { type Environment } from '@schemas/env';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@plugins/web3-abi';

export default async function proposalsRoutes(app: FastifyInstance) {
  const {
    DEFAULT_DB_URL,
    DEFAULT_DB_ANONYMOUS_URL,
    DEFAULT_DB_AUTHENTICATED_URL,
  } = app.getEnvs<Environment>();
  const dbUrl =
    DEFAULT_DB_AUTHENTICATED_URL || DEFAULT_DB_ANONYMOUS_URL || DEFAULT_DB_URL;
  const db = newDbClient(dbUrl);

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
    async (request, _) => {
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

      const dbData = await findAllDocumentsBySpaceId(
        { id: dao_id },
        {
          db,
          filter: {},
          pagination: { offset, pageSize: limit },
        },
      );

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
    },
  );

  /**
   * POST /proposals
   */
  app.post('/', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * GET /proposals/:id
   */
  app.get<{ Reply: ProposalIdResponse; Params: ProposalIdParams }>(
    '/:id',
    {
      schema: {
        params: proposalIdParams,
        response: { '2xx': proposalIdResponse },
      },
    },
    async (request) => {
      const { id } = request.params;

      const dbData = await findDocumentById({ id }, { db });
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
    },
  );

  /**
   * GET /proposals/:id/votes
   */
  app.get<{
    Reply: GetProposalVotersResponse;
    Params: GetProposalVotersParams;
    Querystring: GetProposalVotersQuery;
  }>(
    '/:id/votes',
    {
      schema: {
        params: getProposalVotersParams,
        querystring: getProposalVotersQuery,
        response: { '2xx': getProposalVotersResponse },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { limit, offset } = request.query;

      const web3Id = await findDocumentWeb3Id({ id }, { db });

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

        if (!web3Id) {
          console.error('Missing proposal web3Id for', id, 'proposal');

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
      if (!web3Data) {
        // TODO: implement proper return
        throw new Error('Internal server error');
      }

      const [yesVoters, noVoters] = web3Data;

      const addresses = yesVoters.concat(noVoters);
      const people = peopleByAddresses(
        { addresses },
        {
          pagination: { pageSize: limit, offset },
          db,
        },
      );

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
    },
  );

  /**
   * POST /proposals/:id/vote
   */
  app.post('/:id/vote', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });
}
