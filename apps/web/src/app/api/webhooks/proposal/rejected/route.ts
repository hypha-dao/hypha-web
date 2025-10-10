import {
  Alchemy,
  findDocumentsCreatorsForNotifications,
  findDocumentWithSpaceByIdRaw,
  findPeopleByWeb3Addresses,
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
  emailProposalRejectionForCreator,
  emailProposalRejectionForMembers,
  pushProposalRejectionForCreator,
  pushProposalRejectionForMembers,
} from '@hypha-platform/notifications/template';

export const POST = Alchemy.newHandler(
  {
    signingKey: (() => {
      const key = process.env.WH_PROPOSAL_REJECTED_SIGN_KEY;
      if (!key) throw new Error('Missing key for proposal rejected webhook');

      return key;
    })(),
    abi: daoProposalsImplementationAbi,
    event: 'ProposalRejected',
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
        'Zero creators found in the DB for the "ProposalRejected" event.',
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
      const { body, subject } = emailProposalRejectionForCreator(params);

      return await sendEmailByAlias({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
        alias: {
          include_aliases: { external_id: [params.proposalCreatorSlug!] },
        },
        content: { email_body: body, email_subject: subject },
      });
    });
    const sendingPushes = notificationParams.map(async (params) => {
      const { contents, headings } = pushProposalRejectionForCreator(params);

      return await sendPushByAlias({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
        alias: {
          include_aliases: { external_id: [params.proposalCreatorSlug!] },
        },
        content: { contents, headings },
      });
    });

    const notifying = Promise.allSettled(sendingEmails.concat(sendingPushes));
    (await notifying)
      .filter((res) => res.status === 'rejected')
      .forEach(({ reason }) =>
        console.error(
          'Failed to notify creators about proposal rejection:',
          reason,
        ),
      );
  },
  async (events) => {
    const fetchingProposals = events
      .map(({ args }) => args.proposalId)
      .map(async (id) => {
        return await findDocumentWithSpaceByIdRaw({ id: Number(id) }, { db });
      });
    const proposalsWithSpaces = (await Promise.allSettled(fetchingProposals))
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
    const proposalSpaceAndMembers = (await Promise.allSettled(fetchingMembers))
      .filter((res) => res.status === 'fulfilled')
      .map(({ value }) => value)
      .filter((proposal) => proposal !== null);

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
      const { body, subject } = emailProposalRejectionForMembers(params);

      return await sendEmailByAlias({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
        alias: {
          include_aliases: { external_id: params.notificationRecepies },
        },
        content: { email_body: body, email_subject: subject },
      });
    });
    const sendingPushes = notificationParams.map(async (params) => {
      const { contents, headings } = pushProposalRejectionForMembers(params);

      return await sendPushByAlias({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
        alias: {
          include_aliases: { external_id: params.notificationRecepies },
        },
        content: { contents, headings },
      });
    });

    const notifying = Promise.allSettled(sendingEmails.concat(sendingPushes));
    (await notifying)
      .filter((res) => res.status === 'rejected')
      .forEach(({ reason }) =>
        console.error(
          'Failed to notify space members about proposal rejection:',
          reason,
        ),
      );
  },
);
