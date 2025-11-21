'use server';

import {
  fetchSpaceDetails,
  NotifyProposalCreatedInput,
} from '@hypha-platform/core/client';
import {
  findPeopleByWeb3Addresses,
  findPersonByWeb3Address,
  findPersonsBySlug,
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
import {
  sendPushNotifications,
  sentEmailNotifications,
  sentEmailNotificationsTemplate,
} from '../mutations';
import { TAG_SUB_NEW_PROPOSAL_OPEN } from '../constants';

async function notifyPushProposalCreatedForCreator({
  person,
  space,
  url,
}: {
  person?: Person;
  space?: Space;
  url: string;
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
  url,
  unsubscribeLink,
}: {
  person?: Person;
  space?: Space;
  url: string;
  unsubscribeLink: string;
}) {
  const templateId =
    process.env.NEXT_PUBLIC_EMAIL_TEMPLATE_PROPOSAL_OPEN_FOR_CREATOR || '';
  if (!templateId) {
    throw new Error(
      'Environment variable NEXT_PUBLIC_EMAIL_TEMPLATE_PROPOSAL_OPEN_FOR_CREATOR is not configure, cannot send an email',
    );
  }
  if (!space || !person) {
    throw new Error('Space or person not specified, cannot send an email');
  }
  const customData = {
    space_title: space.title,
    user_name: `${person.name} ${person.surname}`,
    url: url ?? 'https://app.hypha.earth',
    unsubscribe_link: unsubscribeLink ?? 'https://app.hypha.earth',
  };
  await sentEmailNotificationsTemplate({
    templateId,
    customData,
    usernames: person?.slug ? [person.slug] : [],
    requiredTags: {
      [TAG_SUB_NEW_PROPOSAL_OPEN]: 'true',
    },
  });
}
async function notifyPushProposalCreatedForMembersAction(notificationParams: {
  slugs: string[];
  spaceTitle?: string;
  spaceSlug?: string;
  url?: string;
}) {
  const { contents, headings } =
    pushProposalCreationForMembers(notificationParams);

  return await sendPushNotifications({
    contents,
    headings,
    usernames: notificationParams.slugs,
    requiredTags: {
      [TAG_SUB_NEW_PROPOSAL_OPEN]: 'true',
    },
    url: notificationParams.url,
  });
}
async function notifyEmailProposalCreatedForMembersAction(notificationParams: {
  slugs: string[];
  spaceTitle?: string;
  spaceSlug?: string;
  url: string;
  unsubscribeLink: string;
}) {
  const templateId =
    process.env.NEXT_PUBLIC_EMAIL_TEMPLATE_PROPOSAL_OPEN_FOR_MEMBERS || '';
  if (!templateId) {
    throw new Error(
      'Environment variable NEXT_PUBLIC_EMAIL_TEMPLATE_PROPOSAL_OPEN_FOR_MEMBERS is not configure, cannot send an email',
    );
  }
  const { slugs } = notificationParams;
  const persons = await findPersonsBySlug({ slugs }, { db });

  const sendingEmails = persons.map(async (person) => {
    const customData = {
      space_title: notificationParams.spaceTitle ?? '',
      user_name: `${person.name} ${person.surname}`,
      url: notificationParams.url,
      unsubscribe_link: notificationParams.unsubscribeLink,
    };
    return await sentEmailNotificationsTemplate({
      templateId,
      customData,
      usernames: person?.slug ? [person.slug] : [],
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
  unsubscribeLink,
}: {
  spaceId: bigint;
  creator: `0x${string}`;
  url: string;
  unsubscribeLink: string;
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

  const notificationParams = {
    person,
    space,
    url,
    unsubscribeLink,
  };

  const notifications = [
    notifyPushProposalCreatedForCreator(notificationParams),
    notifyEmailProposalCreatedForCreator(notificationParams),
  ];
  return await Promise.all(notifications);
}

async function notifyProposalCreatedForMembersAction({
  proposalId,
  spaceId: spaceWeb3Id,
  url,
  unsubscribeLink,
}: {
  proposalId: bigint;
  spaceId: bigint;
  url: string;
  unsubscribeLink: string;
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
  const { members, spaceId, creator } = spacesDetails[0]!;
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

  const notificationParams = {
    slugs: people.map(({ slug }) => slug!),
    spaceTitle: space?.title,
    spaceSlug: space?.slug,
    url,
    unsubscribeLink,
  };

  const notifications = [
    notifyPushProposalCreatedForMembersAction(notificationParams),
    notifyEmailProposalCreatedForMembersAction(notificationParams),
  ];
  return await Promise.all(notifications);
}

export async function notifyProposalCreatedAction(
  { proposalId, spaceId, creator, url }: NotifyProposalCreatedInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to send notification');
  const safeUrl = url ?? 'https://app.hypha.earth';
  const baseUrl = new URL(safeUrl);
  const lang = baseUrl.pathname.substring(0, 3) || '/en';
  const unsubscribeLink = `${baseUrl.protocol}//${baseUrl.host}${lang}/my-spaces/notification-centre`;
  const notifying = Promise.allSettled([
    notifyProposalCreatedForCreator({
      spaceId,
      creator,
      url: safeUrl,
      unsubscribeLink,
    }),
    notifyProposalCreatedForMembersAction({
      proposalId,
      spaceId,
      url: safeUrl,
      unsubscribeLink,
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
