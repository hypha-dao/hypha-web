import type { FastifyInstance } from 'fastify';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
  votingPowerDelegationImplementationAbi,
  votingPowerDelegationImplementationAddress,
} from '@plugins/web3-abi';
import { schema, type Schema } from './schema';
import ratelimit from '@fastify/rate-limit';

export default async function spacesRoutes(app: FastifyInstance) {
  await app.register(ratelimit, {
    global: false,
    max: 100,
    timeWindow: '1 minute',
  });

  /**
   * @summary Get spaces that user is member of
   */
  app.get<Schema>(
    '/',
    {
      schema,
      config: {
        rateLimit: { max: 100, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const authToken = request.headers.authorization?.split(' ').at(1);
      if (authToken == null) return reply.unauthorized();

      const person = await app.db.findPersonByAuth({ authToken });
      if (!person || person.address == null) {
        return reply.notFound('User not found');
      }

      // TODO: use a proper default
      const spaceFactoryAddress = daoSpaceFactoryImplementationAddress[8453];
      const proposalsAddress = daoProposalsImplementationAddress[8453];
      const votingAddress = votingPowerDelegationImplementationAddress[8453];

      const [delegatedSpaces, memberSpaces] = await app.web3Client.multicall({
        contracts: [
          {
            address: votingAddress,
            abi: votingPowerDelegationImplementationAbi,
            functionName: 'getSpacesForDelegate',
            args: [person.address as `0x${string}`],
          },
          {
            address: spaceFactoryAddress,
            abi: daoSpaceFactoryImplementationAbi,
            functionName: 'getMemberSpaces',
            args: [person.address as `0x${string}`],
          },
        ],
      });
      if (delegatedSpaces.status === 'failure') {
        app.log.error({
          message: 'Failed to fetch delegated spaces',
          error: delegatedSpaces.error,
        });

        return reply.internalServerError();
      }
      if (memberSpaces.status === 'failure') {
        app.log.error({
          message: 'Failed to fetch member spaces',
          error: memberSpaces.error,
        });

        return reply.internalServerError();
      }

      const memberSpacesDetails = await app.web3Client.multicall({
        allowFailure: false,
        contracts: memberSpaces.result.map(
          (id) =>
            ({
              address: spaceFactoryAddress,
              abi: daoSpaceFactoryImplementationAbi,
              functionName: 'getSpaceDetails',
              args: [id],
            } as const),
        ),
      });
      const dirtyDelegatedSpaces = await Promise.all(
        delegatedSpaces.result.map((id) =>
          app.web3Client.multicall({
            allowFailure: false,
            contracts: [
              {
                address: spaceFactoryAddress,
                abi: daoSpaceFactoryImplementationAbi,
                functionName: 'getSpaceDetails',
                args: [id],
              },
              {
                address: votingAddress,
                abi: votingPowerDelegationImplementationAbi,
                functionName: 'getDelegators',
                args: [person.address as `0x${string}`, id],
              },
            ],
          }),
        ),
      );
      const delegatedSpacesDetails = dirtyDelegatedSpaces
        .filter(([details, delegators]) => {
          const [_unity, _quorum, _votingPowerSource, _tokenAdresses, members] =
            details;
          const membersLower = new Set(
            members.map((member) => member.toLowerCase()),
          );

          return delegators.some((delegator) =>
            membersLower.has(delegator.toLowerCase()),
          );
        })
        .map(([details]) => details);

      const userSpacesWithMemberCount = memberSpacesDetails
        .concat(delegatedSpacesDetails)
        .map((details) => {
          const [
            _unity,
            _quorum,
            _votingPowerSource,
            _tokenAddresses,
            members,
            _exitMethod,
            _joinMethod,
            _createdAt,
            _creator,
            executor,
          ] = details;

          return [
            executor.toLowerCase() as `0x${string}`,
            members.length,
          ] as const;
        })
        .reduce(
          (map, [key, value]) => map.set(key, value),
          new Map<`0x${string}`, number>(),
        );

      const dbData = await app.db.findSpacesByAddresses({
        addresses: [...userSpacesWithMemberCount.keys()],
      });

      return await Promise.all(
        dbData.map(async (db) => {
          const members_count =
            userSpacesWithMemberCount.get(
              (db.address?.toLowerCase() as `0x${string}`) || '0x0',
            ) ?? 0;

          const result = {
            id: db.id,
            name: db.title,
            description: db.description,
            cover_image_url: db.leadImage,
            icon_url: db.logoUrl,
            members_count,
            proposals_count: 0,
          };
          if (db.web3SpaceId == null) {
            return result;
          }

          try {
            const [accepted] = await app.web3Client.readContract({
              address: proposalsAddress,
              abi: daoProposalsImplementationAbi,
              functionName: 'getSpaceProposals',
              args: [BigInt(db.web3SpaceId)],
            });

            return {
              ...result,
              proposals_count: accepted.length,
            };
          } catch (error) {
            app.log.error({
              message: 'Failed to fetch proposals of a space',
              error,
            });

            return result;
          }
        }),
      );
    },
  );
}
