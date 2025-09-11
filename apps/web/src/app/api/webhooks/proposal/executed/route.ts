import {
  Alchemy,
  findDocumentsCreatorsForNotifications,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';
import { sendEmailByAlias } from '@hypha-platform/notifications/server';
import { emailProposalExecutionForCreator } from '@hypha-platform/notifications/template';

export const POST = Alchemy.newHandler(
  {
    signingKey: (() => {
      const key = process.env.WH_PROPOSAL_EXECUTED_SIGN_KEY;
      if (!key) throw new Error('Missing key for proposal executed webhook');

      return key;
    })(),
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

    const sendingEmails = creatorsToNotify.map(async (creator) => {
      const { body, subject } = emailProposalExecutionForCreator({
        proposalState: creator.proposalState ?? undefined,
        proposalLabel: creator.proposalLabel ?? undefined,
        proposalTitle: creator.proposalTitle ?? undefined,
        spaceTitle: creator.spaceTitle,
      });

      return await sendEmailByAlias({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
        alias: { include_aliases: { external_id: [creator.slug!] } },
        content: { email_body: body, email_subject: subject },
      });
    });
    (await Promise.allSettled(sendingEmails))
      .filter((res) => res.status === 'rejected')
      .forEach(({ reason }) =>
        console.error(
          'Failed to notify creators about proposal execution:',
          reason,
        ),
      );
  },
);
