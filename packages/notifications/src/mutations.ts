'use server';

import { ProposalCreationProps } from './template';
import { sendPushByAlias } from './sdk/send-push';
import { sendEmailByAlias } from './sdk/send-email';
import { LangMap } from './sdk/types';
import { sdkClient } from './sdk';
import {
  TAG_EMAIL,
  TAG_PUSH,
  TAG_SUB_NEW_PROPOSAL_OPEN,
  TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED,
  TAG_SUBSCRIBED,
} from './constants';

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';

export interface SendNotificationsInput extends ProposalCreationProps {
  proposalCreatorSlug?: string;
}

type TrueFalseType = 'true' | 'false';

interface Tags {
  [TAG_SUBSCRIBED]?: TrueFalseType;
  [TAG_PUSH]?: TrueFalseType;
  [TAG_EMAIL]?: TrueFalseType;
  [TAG_SUB_NEW_PROPOSAL_OPEN]?: TrueFalseType;
  [TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED]?: TrueFalseType;
}

const filterUsers = async (usernames: Array<string>, requiredTags: Tags) => {
  const users = await Promise.all(
    usernames.map(async (username) => ({
      username,
      user: await sdkClient.getUser(ONESIGNAL_APP_ID, 'external_id', username),
    })),
  );
  const filteredUsernames = users
    .filter(({ user }) => {
      const tags = user.properties?.tags;
      if (!tags) {
        return false;
      }
      for (const [tag, value] of Object.entries(requiredTags)) {
        if (typeof tags[tag] === 'undefined' && tags[tag] !== value) {
          return false;
        }
      }
      return true;
    })
    .map(({ username }) => username);
  return filteredUsernames;
};

export const sendPushNotifications = async ({
  contents,
  headings,
  usernames,
}: {
  contents: LangMap;
  headings?: LangMap;
  usernames: string[];
}) => {
  console.log('Send push...');
  const aliases = await filterUsers(usernames, {
    subscribed: 'true',
    push: 'true',
  });
  return await sendPushByAlias({
    app_id: ONESIGNAL_APP_ID,
    alias: {
      include_aliases: {
        external_id: aliases,
      },
    },
    content: { contents, headings },
  });
};

export const sentEmailNotifications = async ({
  body,
  subject,
  usernames,
}: {
  body: string;
  subject: string;
  usernames: string[];
}) => {
  console.log('Send email...');
  const aliases = await filterUsers(usernames, {
    subscribed: 'true',
    email: 'true',
  });
  return await sendEmailByAlias({
    app_id: ONESIGNAL_APP_ID,
    alias: {
      include_aliases: {
        external_id: aliases,
      },
    },
    content: { email_body: body, email_subject: subject },
  });
};
