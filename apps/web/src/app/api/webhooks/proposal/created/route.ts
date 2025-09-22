import {
  Alchemy,
  findPersonByWeb3Address,
  findSpaceByWeb3Id,
} from '@hypha-platform/core/server';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';
import { db } from '@hypha-platform/storage-postgres';
import {
  sendEmailByAlias,
  sendPushByAlias,
} from '@hypha-platform/notifications/server';
import {
  emailProposalCreationForCreator,
  pushProposalCreationForCreator,
} from '@hypha-platform/notifications/template';

export const POST = Alchemy.newHandler(
  {
    signingKey: (() => {
      const key = process.env.WH_PROPOSAL_CREATED_SIGN_KEY;
      if (!key) throw new Error('Missing key for proposal creation webhook');

      return key;
    })(),
    abi: daoProposalsImplementationAbi,
    event: 'ProposalCreated',
  },
  async (events) => {
    const eventsData = events.map(({ args }) => ({
      spaceWeb3Id: args.spaceId,
      creatorWeb3Address: args.creator,
      proposalWeb3Id: args.proposalId,
    }));

    const fetchingDbData = eventsData.map(
      async ({ spaceWeb3Id, creatorWeb3Address, proposalWeb3Id }) => {
        const person = findPersonByWeb3Address(
          { address: creatorWeb3Address },
          { db },
        );
        const space = findSpaceByWeb3Id({ id: Number(spaceWeb3Id) }, { db });

        return { proposalWeb3Id, person: await person, space: await space };
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
    if (dbData.length === 0) {
      console.warn(
        'Zero creators and spaces found in the DB for the "ProposalCreation" event.',
        'Proposal IDs:',
        events.map(({ args }) => args.proposalId),
      );

      return;
    }

    const notificationParams = dbData.map((data) => ({
      proposalCreatorSlug: data.person?.slug,
      creatorName: data.person?.name,
      spaceTitle: data.space?.title,
      spaceSlug: data.space?.slug,
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

    const notifying = Promise.allSettled(sendingEmails.concat(sendingPushes));
    (await notifying)
      .filter((res) => res.status === 'rejected')
      .forEach(({ reason }) =>
        console.error(
          'Failed to notify creators about proposal creation:',
          reason,
        ),
      );
  },
);
