'use server';

import {
  NotifyProposalAcceptedInput,
  NotifyProposalCreatedInput,
  NotifyProposalRejectedInput,
} from '@hypha-platform/core/client';
import {
  findPersonByWeb3Address,
  findSpaceByWeb3Id,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  emailProposalCreationForCreator,
  pushProposalCreationForCreator,
} from '../template';
import { sendPushNotifications, sentEmailNotifications } from './mutations';

async function notifyPushProposalCreatedForCreator({
  spaceId: spaceWeb3Id,
  creator: creatorWeb3Address,
}: {
  spaceId: bigint;
  creator: `0x${string}`;
}) {
  const person = await findPersonByWeb3Address(
    { address: creatorWeb3Address },
    { db },
  );
  const space = await findSpaceByWeb3Id({ id: Number(spaceWeb3Id) }, { db });
  const { contents, headings } = pushProposalCreationForCreator({
    creatorName: person?.name,
    spaceTitle: space?.title,
    spaceSlug: space?.slug,
  });
  return await sendPushNotifications({
    contents,
    headings,
    username: person?.slug!,
  });
}
async function notifyEmailProposalCreatedForCreator({
  spaceId: spaceWeb3Id,
  creator: creatorWeb3Address,
}: {
  spaceId: bigint;
  creator: `0x${string}`;
}) {
  const person = await findPersonByWeb3Address(
    { address: creatorWeb3Address },
    { db },
  );
  const space = await findSpaceByWeb3Id({ id: Number(spaceWeb3Id) }, { db });
  const { body, subject } = emailProposalCreationForCreator({
    creatorName: person?.name,
    spaceTitle: space?.title,
    spaceSlug: space?.slug,
  });
  return await sentEmailNotifications({
    body,
    subject,
    username: person?.slug!,
  });
}
async function notifyPushProposalCreatedForMembersAction({
  proposalId,
}: {
  proposalId: bigint;
}) {}
async function notifyEmailProposalCreatedForMembersAction({
  proposalId,
}: {
  proposalId: bigint;
}) {}

export async function notifyProposalCreatedAction(
  { proposalId, spaceId, creator }: NotifyProposalCreatedInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to send notification');
  const notifications = [
    notifyPushProposalCreatedForCreator({ spaceId, creator }),
    notifyPushProposalCreatedForMembersAction({ proposalId }),
  ];
  if (process.env.NODE_ENV === 'production') {
    notifications.push(
      notifyEmailProposalCreatedForCreator({ spaceId, creator }),
      notifyEmailProposalCreatedForMembersAction({ proposalId }),
    );
  }
  await Promise.all(notifications);
}

export async function notifyProposalAcceptedAction(
  { proposalId }: NotifyProposalAcceptedInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to send notification');
  //TODO
  return {};
}

export async function notifyProposalRejectedAction(
  { proposalId }: NotifyProposalRejectedInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to send notification');
  //TODO
  return {};
}
