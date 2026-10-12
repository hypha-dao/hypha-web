import { Alchemy } from '@hypha-platform/core/server';
import { daoSpaceFactoryImplementationAbi } from '@hypha-platform/core/generated';
import {
  buildSpaceCreatedEvent,
  dispatch,
} from '@hypha-platform/notifications/server';

const spaceCreatedSigningKey = process.env.WH_SPACE_CREATED_SIGN_KEY;

export const POST = spaceCreatedSigningKey
  ? Alchemy.newHandler(
      {
        signingKey: spaceCreatedSigningKey,
        abi: daoSpaceFactoryImplementationAbi,
        event: 'SpaceCreated',
      },
      async (events) => {
        // One notification per creator, however many spaces they created in this batch.
        const spaceIdsByCreator = events.reduce((creators, { args }) => {
          const creator = args.creator.toLowerCase() as `0x${string}`;
          (creators[creator] ??= []).push(args.spaceId);

          return creators;
        }, {} as Record<`0x${string}`, bigint[]>);

        const dispatching = Object.entries(spaceIdsByCreator).map(
          ([creator, spaceIds]) =>
            dispatch(
              buildSpaceCreatedEvent({
                creator: creator as `0x${string}`,
                spacesCount: spaceIds.length,
                spaceIds,
              }),
            ),
        );

        (await Promise.allSettled(dispatching))
          .filter((res) => res.status === 'rejected')
          .forEach(({ reason }) =>
            console.error('Failed to notify about space creation:', reason),
          );
      },
    )
  : async () => {
      console.error('Missing key for space created webhook');

      return Response.json(
        { error: 'Webhook signing key is not configured.' },
        { status: 500 },
      );
    };
