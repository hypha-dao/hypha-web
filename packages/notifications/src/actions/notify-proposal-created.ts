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
  pushProposalCreationForCreator,
  pushProposalCreationForMembers,
} from '../template';
import {
  sendPushNotifications,
  sendEmailNotificationsTemplate,
} from '../mutations';
import { TAG_SUB_NEW_PROPOSAL_OPEN } from '../constants';

async function notifyPushProposalCreatedForCreator({
  person,
  space,
  url,
}: {
  person: Person;
  space: Space;
  url: string;
}) {
  const { contents, headings } = pushProposalCreationForCreator({
    creatorName: person.name,
    spaceTitle: space.title,
    spaceSlug: space.slug,
  });
  await sendPushNotifications({
    contents,
    headings,
    usernames: person.slug ? [person.slug] : [],
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
  person: Person;
  space: Space;
  url: string;
  unsubscribeLink: string;
}) {
  const templateId =
    process.env.NEXT_PUBLIC_EMAIL_TEMPLATE_PROPOSAL_OPEN_FOR_CREATOR || '';
  if (!templateId) {
    throw new Error(
      'Environment variable NEXT_PUBLIC_EMAIL_TEMPLATE_PROPOSAL_OPEN_FOR_CREATOR is not configured, cannot send an email',
    );
  }
  const customData = {
    space_title: space.title,
    user_name: person.name ?? '',
    url,
    unsubscribe_link: unsubscribeLink,
  };
  await sendEmailNotificationsTemplate({
    templateId,
    customData,
    usernames: person.slug ? [person.slug] : [],
    requiredTags: {
      [TAG_SUB_NEW_PROPOSAL_OPEN]: 'true',
    },
  });
}
async function notifyPushProposalCreatedForMembersAction(params: {
  people: Array<Person>;
  spaceTitle?: string;
  spaceSlug?: string;
  url?: string;
}) {
  const usernames = params.people
    .map(({ slug }) => slug)
    .filter(Boolean) as string[];
  const { contents, headings } = pushProposalCreationForMembers(params);

  return await sendPushNotifications({
    contents,
    headings,
    usernames,
    requiredTags: {
      [TAG_SUB_NEW_PROPOSAL_OPEN]: 'true',
    },
    url: params.url,
  });
}
async function notifyEmailProposalCreatedForMembersAction(params: {
  people: Array<Person>;
  spaceTitle?: string;
  spaceSlug?: string;
  url: string;
  unsubscribeLink: string;
}) {
  const templateId =
    process.env.NEXT_PUBLIC_EMAIL_TEMPLATE_PROPOSAL_OPEN_FOR_MEMBERS || '';
  if (!templateId) {
    throw new Error(
      'Environment variable NEXT_PUBLIC_EMAIL_TEMPLATE_PROPOSAL_OPEN_FOR_MEMBERS is not configured, cannot send an email',
    );
  }

  const sendingEmails = params.people.map(async (person) => {
    const customData = {
      space_title: params.spaceTitle ?? '',
      user_name: person.name ?? '',
      url: params.url,
      unsubscribe_link: params.unsubscribeLink,
    };
    return await sendEmailNotificationsTemplate({
      templateId,
      customData,
      usernames: person.slug ? [person.slug] : [],
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
  creator,
  url,
  unsubscribeLink,
}: {
  proposalId: bigint;
  spaceId: bigint;
  creator: `0x${string}`;
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
  if (!spacesDetails || spacesDetails.length === 0 || !spacesDetails[0]) {
    console.warn(
      'Zero spaces found in the blockchain for the "ProposalCreation" event.',
      'Proposal IDs:',
      [proposalId],
    );

    return;
  }
  const [{ members, spaceId }] = spacesDetails;
  const normalizedCreator = creator.toUpperCase();
  const filteredMembers = members.filter(
    (member) => member.toUpperCase() !== normalizedCreator,
  );
  const people = await findPeopleByWeb3Addresses(
    {
      addresses: filteredMembers as string[],
    },
    { db },
  );
  const space = await findSpaceByWeb3Id({ id: Number(spaceId) }, { db });

  const notificationParams = {
    people,
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
  //TODO: implement auth later
  const safeUrl = url ?? 'https://app.hypha.earth';
  const baseUrl = (() => {
    try {
      return new URL(safeUrl);
    } catch {
      return new URL('https://app.hypha.earth/en');
    }
  })();
  const langMatch = baseUrl.pathname.match(/^\/[a-z]{2}(?=\/|$)/i);
  const lang = langMatch?.[0] ?? '/en';
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
      creator,
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
