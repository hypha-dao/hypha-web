import {
  Alchemy,
  decodeJoinRequestProposal,
  findPersonByWeb3Address,
  findSpaceByWeb3Id,
  findPeopleByWeb3Addresses,
} from '@hypha-platform/core/server';
import { fetchSpaceDetails } from '@hypha-platform/core/client';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';
import { db } from '@hypha-platform/storage-postgres';
import {
  sendEmailByAlias,
  sendPushByAlias,
} from '@hypha-platform/notifications/server';
import {
  emailProposalCreationForCreator,
  emailProposalCreationForMembers,
  pushProposalCreationForCreator,
  pushProposalCreationForMembers,
} from '@hypha-platform/notifications/template';

const proposalCreatedSigningKey = process.env.WH_PROPOSAL_CREATED_SIGN_KEY;

export const POST = proposalCreatedSigningKey
  ? Alchemy.newHandler(
      {
        signingKey: proposalCreatedSigningKey,
        abi: daoProposalsImplementationAbi,
        event: 'ProposalCreated',
      },
      async (events) => {
        const eventsData = events.map(({ args }) => {
          // Join requests are created on-chain by DAOSpaceFactory.joinSpace(),
          // so the event's `creator` is the factory contract — the actual
          // requester has to be recovered from the executionData.
          const joinRequesterAddress = decodeJoinRequestProposal({
            creator: args.creator,
            executionData: args.executionData,
          });

          return {
            spaceWeb3Id: args.spaceId,
            creatorWeb3Address: joinRequesterAddress ?? args.creator,
            proposalWeb3Id: args.proposalId,
            isJoinRequest: joinRequesterAddress !== null,
          };
        });

        const fetchingDbData = eventsData.map(
          async ({
            spaceWeb3Id,
            creatorWeb3Address,
            proposalWeb3Id,
            isJoinRequest,
          }) => {
            const person = findPersonByWeb3Address(
              { address: creatorWeb3Address },
              { db },
            );
            const space = findSpaceByWeb3Id(
              { id: Number(spaceWeb3Id) },
              { db },
            );

            return {
              proposalWeb3Id,
              isJoinRequest,
              person: await person,
              space: await space,
            };
          },
        );
        const resultFetchingDbData = await Promise.allSettled(fetchingDbData);
        resultFetchingDbData
          .filter((failure) => failure.status === 'rejected')
          .forEach(({ reason }) =>
            console.error('Failed to fetch person and space from DB:', reason),
          );

        const dbData = resultFetchingDbData
          .filter((res) => res.status === 'fulfilled')
          .map(({ value }) => value);
        const completeDbData = dbData.filter(
          (data) => data.person?.slug && data.space?.slug,
        );
        const skippedCreatorEntries = dbData.length - completeDbData.length;
        if (skippedCreatorEntries > 0) {
          console.warn(
            `Skipped ${skippedCreatorEntries} proposal creation creator notifications due to missing person/space DB data.`,
          );
        }
        if (completeDbData.length === 0) {
          console.warn(
            'Zero creators and spaces found in the DB for the "ProposalCreation" event.',
            'Proposal IDs:',
            events.map(({ args }) => args.proposalId),
          );

          return;
        }

        const notificationParams = completeDbData.map((data) => ({
          proposalCreatorSlug: data.person?.slug,
          creatorName: data.person?.name,
          spaceTitle: data.space?.title,
          spaceSlug: data.space?.slug,
          proposalLabel: data.isJoinRequest ? 'Invite' : undefined,
        }));
        const sendingEmails = notificationParams.map(async (params) => {
          const { body, subject } = emailProposalCreationForCreator(params);

          return await sendEmailByAlias({
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
            alias: {
              include_aliases: { external_id: [params.proposalCreatorSlug!] },
            },
            content: { email_body: body, email_subject: subject },
          });
        });
        const sendingPushes = notificationParams.map(async (params) => {
          const { contents, headings } = pushProposalCreationForCreator(params);

          return await sendPushByAlias({
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
            alias: {
              include_aliases: { external_id: [params.proposalCreatorSlug!] },
            },
            content: { contents, headings },
          });
        });

        const notifying = Promise.allSettled(
          sendingEmails.concat(sendingPushes),
        );
        (await notifying)
          .filter((res) => res.status === 'rejected')
          .forEach(({ reason }) =>
            console.error(
              'Failed to notify creators about proposal creation:',
              reason,
            ),
          );
      },
      async (events) => {
        const eventsData = events.map(({ args }) => ({
          spaceWeb3Id: args.spaceId,
          joinRequesterAddress: decodeJoinRequestProposal({
            creator: args.creator,
            executionData: args.executionData,
          }),
        }));
        const spaceIds = eventsData.map(({ spaceWeb3Id }) => spaceWeb3Id);

        const spacesDetails = await (async () => {
          try {
            return await fetchSpaceDetails({ spaceIds });
          } catch (e) {
            console.error(
              'Failed to fetch space details for proposal creation:',
              e,
            );
          }
        })();
        if (!spacesDetails || spacesDetails.length === 0) {
          console.warn(
            'Zero spaces found in the blockchain for the "ProposalCreation" event.',
            'Proposal IDs:',
            events.map(({ args }) => args.proposalId),
          );

          return;
        }

        // fetchSpaceDetails preserves the input order, so entries align with
        // eventsData by index.
        const fetchingData = spacesDetails.map(
          async ({ members, spaceId }, index) => {
            const joinRequesterAddress =
              eventsData[index]?.spaceWeb3Id === spaceId
                ? eventsData[index]?.joinRequesterAddress ?? null
                : null;

            const [people, space, joinRequester] = await Promise.all([
              findPeopleByWeb3Addresses(
                {
                  addresses: members as string[],
                },
                { db },
              ),
              findSpaceByWeb3Id({ id: Number(spaceId) }, { db }),
              joinRequesterAddress
                ? findPersonByWeb3Address(
                    { address: joinRequesterAddress },
                    { db },
                  )
                : Promise.resolve(null),
            ]);

            return {
              people,
              space,
              isJoinRequest: joinRequesterAddress !== null,
              joinRequester,
            };
          },
        );
        const spacesWithPeople = (await Promise.allSettled(fetchingData))
          .filter((res) => res.status === 'fulfilled')
          .map(({ value }) => value)
          .filter(
            (entry) =>
              entry.people.length > 0 &&
              Boolean(entry.space?.slug) &&
              Boolean(entry.space?.title),
          );

        const notificationParams = spacesWithPeople.map(
          ({ space, people, isJoinRequest, joinRequester }) => ({
            slugs: people.map(({ slug }) => slug!),
            spaceTitle: space!.title,
            spaceSlug: space!.slug,
            proposalLabel: isJoinRequest ? 'Invite' : undefined,
            creatorName: isJoinRequest
              ? [joinRequester?.name, joinRequester?.surname]
                  .filter(Boolean)
                  .join(' ') || undefined
              : undefined,
          }),
        );

        const sendingEmails = notificationParams.map(async (params) => {
          const { body, subject } = emailProposalCreationForMembers(params);

          return await sendEmailByAlias({
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
            alias: {
              include_aliases: { external_id: params.slugs },
            },
            content: { email_body: body, email_subject: subject },
          });
        });
        const sendingPushes = notificationParams.map(async (params) => {
          const { contents, headings } = pushProposalCreationForMembers(params);

          return await sendPushByAlias({
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
            alias: {
              include_aliases: { external_id: params.slugs },
            },
            content: { contents, headings },
          });
        });

        const notifying = Promise.allSettled(
          sendingEmails.concat(sendingPushes),
        );
        (await notifying)
          .filter((res) => res.status === 'rejected')
          .forEach(({ reason }) =>
            console.error(
              'Failed to notify space members about proposal creation:',
              reason,
            ),
          );
      },
    )
  : async () => {
      console.error('Missing key for proposal creation webhook');

      return Response.json(
        { error: 'Webhook signing key is not configured.' },
        { status: 500 },
      );
    };
