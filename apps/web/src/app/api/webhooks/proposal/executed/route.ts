import {
  Alchemy,
  findDocumentsCreatorsForNotifications,
  findSpaceByWeb3Id,
  findPersonByWeb3Address,
  createAgreement,
  web3Client,
} from '@hypha-platform/core/server';
import {
  getProposalDetails,
  decodeTransaction,
} from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';
import {
  sendEmailByAlias,
  sendPushByAlias,
} from '@hypha-platform/notifications/server';
import {
  emailProposalExecutionForCreator,
  pushProposalExecutionForCreator,
} from '@hypha-platform/notifications/template';

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
      const { contents, headings } = pushProposalExecutionForCreator(params);

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
          'Failed to notify creators about proposal execution:',
          reason,
        ),
      );
  },
  async (events) => {
    const proposalIds = events.map(({ args }) => args.proposalId);

    const proposalDetailsParams = proposalIds.map((proposalId) =>
      getProposalDetails({ proposalId }),
    );
    const proposalsRes = await web3Client.multicall({
      blockTag: 'latest',
      contracts: proposalDetailsParams,
    });
    const fetchingProposals = proposalsRes
      .map((res, index) => {
        if (res.status !== 'success') {
          return null;
        }

        const [
          spaceId,
          startTime,
          endTime,
          executed,
          expired,
          yesVotes,
          noVotes,
          totalVotingPowerAtSnapshot,
          creator,
          rawTransactions,
        ] = res.result;
        const transactions = rawTransactions
          .map((trx) => decodeTransaction(trx))
          .filter((trx) => trx !== null)
          .filter((trx) => trx.type === 'joinSpace');

        return {
          id: proposalIds[index]!,
          spaceId,
          startTime,
          endTime,
          executed,
          expired,
          yesVotes,
          noVotes,
          totalVotingPowerAtSnapshot,
          creator,
          transactions,
        };
      })
      .filter((proposal) => proposal !== null)
      .filter((proposal) => proposal.transactions.length > 0)
      .map(({ transactions, ...restOfProposal }) => ({
        // TODO: handle multiple joins in a proposal
        join: transactions.at(0)!,
        ...restOfProposal,
      }))
      .map(async ({ creator: address, join, ...rest }) => {
        const space = await findSpaceByWeb3Id(
          { id: Number(join.data.spaceId) },
          { db },
        );
        const creator = await findPersonByWeb3Address({ address }, { db });

        return { space, creator, ...rest };
      });

    const fetchedProposals = await Promise.allSettled(fetchingProposals);
    const proposals = fetchedProposals
      .filter((proposal) => proposal.status === 'fulfilled')
      .map(({ value }) => value);
    if (proposals.length === 0) return;

    const agreements = proposals
      .map((proposal) => {
        if (proposal.space === null || proposal.creator === null) {
          return null;
        }

        const spaceId = proposal.space.id;
        const name = proposal.creator.name;
        const surname = proposal.creator.surname;
        const slug = proposal.creator.slug;
        const creatorId = proposal.creator.id;
        const address = proposal.creator.address;

        // TODO: put appropriate language
        const profilePageUrl = `/en/profile/${slug}`;

        return {
          title: 'Invite Member',
          description: `**${name} ${surname} has just requested to join as a member!**

        To move forward with onboarding, we'll need our space's approval on this proposal.

        You can review ${name}'s profile <span className="text-accent-9">[here](${profilePageUrl}).</span>`,
          creatorId,
          memberAddress: address as `0x${string}`,
          slug: `invite-request-${spaceId}-${Date.now()}`,
          label: 'Invite',
          web3ProposalId: Number(proposal.id),
          spaceId,
        };
      })
      .filter((agreement) => agreement !== null);

    const creatingAgreements = agreements.map(
      async (agreement) => await createAgreement(agreement, { db }),
    );
    (await Promise.allSettled(creatingAgreements))
      .filter((res) => res.status === 'rejected')
      .forEach(({ reason }) =>
        console.error(
          'Failed to create an agreement from joinSpace proposal:',
          reason,
        ),
      );
  },
);
