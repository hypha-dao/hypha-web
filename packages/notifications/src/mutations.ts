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
  const results = await Promise.allSettled(
    usernames.map(async (username) => ({
      username,
      user: await sdkClient.getUser(ONESIGNAL_APP_ID, 'external_id', username),
    })),
  );
  const users = results
    .filter(
      (r): r is PromiseFulfilledResult<{ username: string; user: any }> =>
        r.status === 'fulfilled',
    )
    .map((r) => r.value);
  const filteredUsernames = users
    .filter(({ user }) => {
      const tags = user.properties?.tags;
      if (!tags) {
        return false;
      }
      const hasMismatch = Object.entries(requiredTags).some(([tag, value]) => {
        return !Object.hasOwn(tags, tag) || tags[tag] !== value;
      });
      if (hasMismatch) {
        return false;
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
  if (!ONESIGNAL_APP_ID) {
    throw new Error('ONESIGNAL_APP_ID environment variable is not set');
  }

  console.log('Send push...');
  const aliases = await filterUsers(usernames, {
    subscribed: 'true',
    push: 'true',
    ...requiredTags,
  });

  if (aliases.length === 0) {
    console.warn('No users matched push notification criteria');
    return null;
  }

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

export const sendPushNotificationsTemplate = async ({
  templateId,
  customData,
  usernames,
  requiredTags,
  url,
}: {
  templateId: string;
  customData?: Record<string, string>;
  usernames: string[];
  requiredTags?: Tags;
  url?: string;
}) => {
  if (!ONESIGNAL_APP_ID) {
    throw new Error('ONESIGNAL_APP_ID environment variable is not set');
  }

  console.log('Send push...');
  const aliases = await filterUsers(usernames, {
    subscribed: 'true',
    push: 'true',
    ...requiredTags,
  });

  if (aliases.length === 0) {
    console.warn('No users matched push notification criteria');
    return null;
  }

  return await sendPushByAlias({
    app_id: ONESIGNAL_APP_ID,
    alias: {
      include_aliases: {
        external_id: aliases,
      },
    },
    content: { template_id: templateId, custom_data: customData },
    url,
  });
};

export const sendEmailNotifications = async ({
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
  if (!ONESIGNAL_APP_ID) {
    throw new Error('ONESIGNAL_APP_ID environment variable is not set');
  }

  console.log('Send email...');
  const aliases = await filterUsers(usernames, {
    subscribed: 'true',
    email: 'true',
    ...requiredTags,
  });

  if (aliases.length === 0) {
    console.warn('No users matched email notification criteria');
    return null;
  }

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

export const sendEmailNotificationsTemplate = async ({
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
  if (!ONESIGNAL_APP_ID) {
    throw new Error('ONESIGNAL_APP_ID environment variable is not set');
  }

  console.log('Send email...');
  const aliases = await filterUsers(usernames, {
    subscribed: 'true',
    email: 'true',
    ...requiredTags,
  });

  if (aliases.length === 0) {
    console.warn('No users matched email notification criteria');
    return null;
  }

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
