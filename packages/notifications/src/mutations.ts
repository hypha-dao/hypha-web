'use server';

import { ProposalCreationProps } from './template';
import { sendPushByAlias } from './sdk/send-push';
import { sendEmailByAlias } from './sdk/send-email';
import { LangMap } from './sdk/types';
import { sdkClient } from './sdk';

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';

export interface SendNotificationsInput extends ProposalCreationProps {
  proposalCreatorSlug?: string;
}

export interface Tags {
  [key: string]: string;
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
        if (typeof tags[tag] === 'undefined' || tags[tag] !== value) {
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
  requiredTags,
  url,
}: {
  contents: LangMap;
  headings?: LangMap;
  usernames: string[];
  requiredTags?: Tags;
  url?: string;
}) => {
  console.log('Send push...');
  const aliases = await filterUsers(usernames, {
    subscribed: 'true',
    push: 'true',
    ...requiredTags,
  });
  return await sendPushByAlias({
    app_id: ONESIGNAL_APP_ID,
    alias: {
      include_aliases: {
        external_id: aliases,
      },
    },
    content: { contents, headings },
    url,
  });
};

export const sentEmailNotifications = async ({
  body,
  subject,
  usernames,
  requiredTags,
}: {
  body: string;
  subject: string;
  usernames: string[];
  requiredTags?: Tags;
}) => {
  console.log('Send email...');
  const aliases = await filterUsers(usernames, {
    subscribed: 'true',
    email: 'true',
    ...requiredTags,
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

export const sentEmailNotificationsTemplate = async ({
  templateId,
  customData,
  usernames,
  requiredTags,
}: {
  templateId: string;
  customData?: Record<string, string>;
  usernames: string[];
  requiredTags?: Tags;
}) => {
  console.log('Send email...');
  const aliases = await filterUsers(usernames, {
    subscribed: 'true',
    email: 'true',
    ...requiredTags,
  });
  return await sendEmailByAlias({
    app_id: ONESIGNAL_APP_ID,
    alias: {
      include_aliases: {
        external_id: aliases,
      },
    },
    content: { template_id: templateId, custom_data: customData },
  });
};
