import {
  Alchemy,
  findDocumentsCreatorsForNotifications,
  findDocumentWithSpaceByIdRaw,
  findPeopleByWeb3Addresses,
  linkDeployedTokenForProposal,
  web3Client,
} from '@hypha-platform/core/server';
import { getSpaceDetails } from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';
import {
  sendEmailByAlias,
  sendPushByAlias,
} from '@hypha-platform/notifications/server';
import {
  emailProposalExecutionForCreator,
  emailProposalExecutionForMembers,
  pushProposalExecutionForCreator,
  pushProposalExecutionForMembers,
} from '@hypha-platform/notifications/template';

const proposalExecutedSigningKey = process.env.WH_PROPOSAL_EXECUTED_SIGN_KEY;

export const POST = proposalExecutedSigningKey
  ? Alchemy.newHandler(
      {
        signingKey: proposalExecutedSigningKey,
        abi: daoProposalsImplementationAbi,
        event: 'ProposalExecuted',
      },
      async (events) => {
        const proposalIds = events
          .filter(
            ({ args }) =>
              args.proposalId <= BigInt(Number.MAX_SAFE_INTEGER) &&
              args.proposalId >= BigInt(Number.MIN_SAFE_INTEGER),
          )
          .map(({ args }) => Number(args.proposalId));

        const creatorsToNotify = await findDocumentsCreatorsForNotifications(
          { proposalIds },
          { db },
        );
        if (creatorsToNotify.length === 0) {
          console.warn(
            'Zero creators found in the DB for the "ProposalExecuted" event.',
            'Proposal IDs:',
            proposalIds,
          );

          return;
        }

        const notificationParams = creatorsToNotify.map((creator) => ({
          proposalCreatorSlug: creator.slug,
          proposalState: creator.proposalState ?? undefined,
          proposalLabel: creator.proposalLabel ?? undefined,
          proposalTitle: creator.proposalTitle ?? undefined,
          spaceTitle: creator.spaceTitle,
        }));
        const sendingEmails = notificationParams.map(async (params) => {
          const { body, subject } = emailProposalExecutionForCreator(params);

          return await sendEmailByAlias({
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
            alias: {
              include_aliases: { external_id: [params.proposalCreatorSlug!] },
            },
            content: { email_body: body, email_subject: subject },
          });
        });
        const sendingPushes = notificationParams.map(async (params) => {
          const { contents, headings } =
            pushProposalExecutionForCreator(params);

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
              'Failed to notify creators about proposal execution:',
              reason,
            ),
          );
      },
      async (events) => {
        const safeProposalIds = events
          .map(({ args }) => args.proposalId)
          .filter(
            (id) =>
              id <= BigInt(Number.MAX_SAFE_INTEGER) &&
              id >= BigInt(Number.MIN_SAFE_INTEGER),
          )
          .map((id) => Number(id));
        const fetchingProposals = safeProposalIds.map(async (id) => {
          return await findDocumentWithSpaceByIdRaw({ id }, { db });
        });
        const proposalsWithSpaces = (
          await Promise.allSettled(fetchingProposals)
        )
          .filter((res) => res.status === 'fulfilled')
          .map(({ value }) => value)
          .filter((proposal) => proposal !== null);

        const fetchingMembers = proposalsWithSpaces.map(
          async ({ document, space }) => {
            const spaceId = space.web3SpaceId;
            if (!spaceId) return null;

            const spaceDetails = await web3Client.readContract(
              getSpaceDetails({ spaceId: BigInt(spaceId) }),
            );
            // TODO: fix type
            const memberAddresses = spaceDetails.at(4) as `0x${string}`[];
            const members = await findPeopleByWeb3Addresses(
              { addresses: memberAddresses },
              { db },
            );

            return {
              document,
              space,
              members,
            };
          },
        );
        const proposalSpaceAndMembers = (
          await Promise.allSettled(fetchingMembers)
        )
          .filter((res) => res.status === 'fulfilled')
          .map(({ value }) => value)
          .filter((data) => data !== null);
        if (proposalSpaceAndMembers.length === 0) return;

        const notificationParams = proposalSpaceAndMembers.map(
          ({ document, space, members }) => ({
            notificationRecepies: members.map(({ slug }) => slug!),
            proposalState: document.state ?? undefined,
            proposalLabel: document.label ?? undefined,
            proposalTitle: document.title ?? undefined,
            spaceTitle: space.title,
          }),
        );
        const sendingEmails = notificationParams.map(async (params) => {
          const { body, subject } = emailProposalExecutionForMembers(params);

          return await sendEmailByAlias({
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
            alias: {
              include_aliases: { external_id: params.notificationRecepies },
            },
            content: { email_body: body, email_subject: subject },
          });
        });
        const sendingPushes = notificationParams.map(async (params) => {
          const { contents, headings } =
            pushProposalExecutionForMembers(params);

          return await sendPushByAlias({
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
            alias: {
              include_aliases: { external_id: params.notificationRecepies },
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
              'Failed to notify space members about proposal execution:',
              reason,
            ),
          );
      },
      async (events) => {
        // Server-side token-address backfill: deterministically links a
        // deployed token's address to its DB row when a deploy proposal
        // executes, independent of any browser being open. No-ops for
        // non-token proposals.
        const linking = events.map(async (event) => {
          const proposalId = event.args.proposalId;
          if (
            proposalId > BigInt(Number.MAX_SAFE_INTEGER) ||
            proposalId < BigInt(Number.MIN_SAFE_INTEGER)
          ) {
            return;
          }

          const result = await linkDeployedTokenForProposal(
            {
              proposalId: Number(proposalId),
              transactionHash: event.transactionHash,
            },
            { db },
          );

          if (result.status === 'linked') {
            console.info(
              `Linked deployed token ${result.address} for proposal ${proposalId}.`,
            );
          }
        });

        (await Promise.allSettled(linking))
          .filter((res) => res.status === 'rejected')
          .forEach(({ reason }) =>
            console.error(
              'Failed to link deployed token for proposal:',
              reason,
            ),
          );
      },
    )
  : async () => {
      console.error('Missing key for proposal executed webhook');

      return Response.json(
        { error: 'Webhook signing key is not configured.' },
        { status: 500 },
      );
    };
