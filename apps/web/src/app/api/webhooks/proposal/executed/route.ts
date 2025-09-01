import { Alchemy } from '@hypha-platform/core/server';
import {
  type Document,
  db,
  documents,
  spaces,
  people,
} from '@hypha-platform/storage-postgres';
import { sql, eq, inArray } from 'drizzle-orm';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';
import { sendEmailByAlias } from '@hypha-platform/notifications/server';

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
      .map(({ args }) => Number(args.proposalId))
      .filter((id) => id > 0 && Number.isInteger(id));

    const creatorsToNotify = await db
      .select({
        slug: people.slug,
        proposals: sql<
          Array<
            Pick<Document, 'label' | 'title' | 'state'> & {
              spaceTitle: string;
              spaceSlug: string;
            }
          >
        >`
            array_agg(
              to_jsonb(
                json_build_object(
                  'spaceTitle', ${spaces}.title,
                  'spaceSlug', ${spaces}.slug,
                  'title', ${documents}.title,
                  'label', ${documents}.label,
                  'state', ${documents}.state
                )
              )
            )
          `,
      })
      .from(documents)
      .innerJoin(people, eq(documents.creatorId, people.id))
      .innerJoin(spaces, eq(documents.spaceId, spaces.id))
      .where(inArray(documents.web3ProposalId, proposalIds))
      .groupBy(people.id, spaces.id);
    if (creatorsToNotify.length === 0) {
      console.warn(
        'Zero creators found in the DB for the "ProposalExecuted" event.',
        'Proposal IDs:',
        proposalIds,
      );

      return;
    }

    const joinsToNotify = creatorsToNotify
      .map((creator) => ({
        ...creator,
        proposals: creator.proposals.filter(
          (proposal) => proposal.label === 'Invite',
        ),
      }))
      .map(({ slug, proposals }) => ({
        slug,
        subject: `You've joined the space${proposals.length > 1 ? 's' : ''}`,
        body: proposals.reduce(
          (body, { spaceTitle }) => body + `- ${spaceTitle}\n`,
          "You've successfully joined the following spaces:\n",
        ),
      }));

    const proposalsToNotify = creatorsToNotify
      .map((creator) => ({
        ...creator,
        proposals: creator.proposals.filter(
          (proposal) => proposal.label !== 'Invite',
        ),
      }))
      .map(({ slug, proposals }) => ({
        slug,
        subject: `Your proposal${
          proposals.length > 1 ? 's' : ''
        } were successfully executed`,
        body: proposals.reduce(
          (body, { spaceTitle, state, title, label }) =>
            body +
            `- ${state} "${title || label}" in the space "${spaceTitle}"\n`,
          'The follwing proposals were successfuly executed:\n',
        ),
      }));

    const sendingEmails = joinsToNotify.concat(proposalsToNotify).map(
      async ({ slug, subject, body }) =>
        await sendEmailByAlias({
          app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
          alias: { include_aliases: { external_id: [slug!] } },
          content: { email_body: body, email_subject: subject },
        }),
    );
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
