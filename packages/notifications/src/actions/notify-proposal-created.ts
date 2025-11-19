'use server';

import {
  fetchSpaceDetails,
  NotifyProposalCreatedInput,
} from '@hypha-platform/core/client';
import {
  findPeopleByWeb3Addresses,
  findPersonByWeb3Address,
  findSpaceByWeb3Id,
  Person,
  Space,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  emailProposalCreationForCreator,
  emailProposalCreationForMembers,
  pushProposalCreationForCreator,
  pushProposalCreationForMembers,
} from '../template';
import { sendPushNotifications, sentEmailNotifications } from '../mutations';
import { TAG_SUB_NEW_PROPOSAL_OPEN } from '../constants';

async function notifyPushProposalCreatedForCreator({
  person,
  space,
  url,
}: {
  person?: Person;
  space?: Space;
  url?: string;
}) {
  const { contents, headings } = pushProposalCreationForCreator({
    creatorName: person?.name,
    spaceTitle: space?.title,
    spaceSlug: space?.slug,
  });
  await sendPushNotifications({
    contents,
    headings,
    usernames: person?.slug ? [person.slug] : [],
    requiredTags: {
      [TAG_SUB_NEW_PROPOSAL_OPEN]: 'true',
    },
    url,
  });
}
async function notifyEmailProposalCreatedForCreator({
  person,
  space,
}: {
  person?: Person;
  space?: Space;
}) {
  const { body, subject } = emailProposalCreationForCreator({
    creatorName: person?.name,
    spaceTitle: space?.title,
    spaceSlug: space?.slug,
  });
  await sentEmailNotifications({
    body,
    subject,
    usernames: person?.slug ? [person.slug] : [],
    requiredTags: {
      [TAG_SUB_NEW_PROPOSAL_OPEN]: 'true',
    },
  });
}
async function notifyPushProposalCreatedForMembersAction(
  notificationParams: {
    slugs: string[];
    spaceTitle?: string;
    spaceSlug?: string;
  }[],
  url?: string,
) {
  const sendingPushes = notificationParams.map(async (params) => {
    const { contents, headings } = pushProposalCreationForMembers(params);

    return await sendPushNotifications({
      contents,
      headings,
      usernames: params.slugs,
      requiredTags: {
        [TAG_SUB_NEW_PROPOSAL_OPEN]: 'true',
      },
      url,
    });
  });
  await Promise.all(sendingPushes);
}
async function notifyEmailProposalCreatedForMembersAction(
  notificationParams: {
    slugs: string[];
    spaceTitle?: string;
    spaceSlug?: string;
  }[],
) {
  const sendingEmails = notificationParams.map(async (params) => {
    const { body, subject } = emailProposalCreationForMembers(params);

    return await sentEmailNotifications({
      body,
      subject,
      usernames: params.slugs,
      requiredTags: {
        [TAG_SUB_NEW_PROPOSAL_OPEN]: 'true',
      },
    });
  });
  await Promise.all(sendingEmails);
}

async function notifyProposalCreatedForCreator({
  spaceId: spaceWeb3Id,
  creator: creatorWeb3Address,
  url,
}: {
  spaceId: bigint;
  creator: `0x${string}`;
  url?: string;
}) {
  const person = await findPersonByWeb3Address(
    { address: creatorWeb3Address },
    { db },
  );
  const space = await findSpaceByWeb3Id({ id: Number(spaceWeb3Id) }, { db });
  if (!person || !space) {
    console.warn('Not found space or person for sending notification.');
    return [];
  }

  const notifications = [
    notifyPushProposalCreatedForCreator({ person, space, url }),
  ];
  if (process.env.NODE_ENV === 'production') {
    notifications.push(notifyEmailProposalCreatedForCreator({ person, space }));
  }
  return await Promise.all(notifications);
}

async function notifyProposalCreatedForMembersAction({
  proposalId,
  spaceId: spaceWeb3Id,
  url,
}: {
  proposalId: bigint;
  spaceId: bigint;
  url?: string;
}) {
  const spaceIds = [spaceWeb3Id];
  const spacesDetails = await (async () => {
    try {
      return await fetchSpaceDetails({ spaceIds });
    } catch (e) {
      console.error('Failed to fetch space details for proposal creation:', e);
    }
  })();
  if (!spacesDetails || spacesDetails.length === 0) {
    console.warn(
      'Zero spaces found in the blockchain for the "ProposalCreation" event.',
      'Proposal IDs:',
      [proposalId],
    );

    return;
  }
  const fetchingData = spacesDetails.map(
    async ({ members, spaceId, creator }) => {
      const filteredMembers = members.filter(
        (member) => member.toUpperCase() !== creator.toUpperCase(),
      );
      const people = await findPeopleByWeb3Addresses(
        {
          addresses: filteredMembers as string[],
        },
        { db },
      );
      const space = await findSpaceByWeb3Id({ id: Number(spaceId) }, { db });

      return { people, space };
    },
  );
  const spacesWithPeople = (await Promise.allSettled(fetchingData))
    .filter((res) => res.status === 'fulfilled')
    .map(({ value }) => value)
    .filter((space) => space.people.length > 0);

  const notificationParams = spacesWithPeople.map(({ space, people }) => ({
    slugs: people.map(({ slug }) => slug!),
    spaceTitle: space?.title,
    spaceSlug: space?.slug,
  }));

  const notifications = [
    notifyPushProposalCreatedForMembersAction(notificationParams, url),
  ];
  if (process.env.NODE_ENV === 'production') {
    notifications.push(
      notifyEmailProposalCreatedForMembersAction(notificationParams),
    );
  }
  return await Promise.all(notifications);
}

export async function notifyProposalCreatedAction(
  { proposalId, spaceId, creator, url }: NotifyProposalCreatedInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to send notification');
  const notifying = Promise.allSettled([
    notifyProposalCreatedForCreator({
      spaceId,
      creator,
      url,
    }),
    notifyProposalCreatedForMembersAction({
      proposalId,
      spaceId,
      url,
    }),
  ]);
  (await notifying)
    .filter((res) => res.status === 'rejected')
    .forEach(({ reason }) =>
      console.error(
        'Failed to notify space members about proposal creation:',
        reason,
      ),
    );
}
