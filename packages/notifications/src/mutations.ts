'use server';

import { ProposalCreationProps } from './template';
import { sendPushByAlias } from './sdk/send-push';
import { sendEmailByAlias } from './sdk/send-email';
import { LangMap } from './sdk/types';
import { resolveConsentedSlugs, type ConsentTags } from './core/consent-gate';

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';

export interface SendNotificationsInput extends ProposalCreationProps {
  proposalCreatorSlug?: string;
}

export interface Tags {
  [key: string]: string;
}

/** @deprecated moved to `core/consent-gate.ts::resolveConsentedSlugs` (#2470) — kept as a thin alias here so this file's call sites don't change until they migrate onto the new decision layer. */
const filterUsers = (usernames: Array<string>, requiredTags: Tags) =>
  resolveConsentedSlugs(usernames, requiredTags as ConsentTags);

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

/** Sends a plain email directly to addresses (no OneSignal subscription / tags required). */
export const sendEmailNotificationsToEmails = async ({
  body,
  subject,
  emails,
}: {
  body: string;
  subject: string;
  emails: string[];
}) => {
  if (!ONESIGNAL_APP_ID) {
    throw new Error('ONESIGNAL_APP_ID environment variable is not set');
  }

  const recipients = [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
  if (recipients.length === 0) {
    console.warn('No email recipients for notification');
    return null;
  }

  console.log('Send email to addresses...');
  return await sendEmailByAlias({
    app_id: ONESIGNAL_APP_ID,
    alias: { include_email_tokens: recipients },
    content: { email_body: body, email_subject: subject },
  });
};

/** Sends a templated email directly to addresses (no Hypha user / subscription required). */
export const sendEmailNotificationsTemplateToEmails = async ({
  templateId,
  customData,
  emails,
}: {
  templateId: string;
  customData?: Record<string, string>;
  emails: string[];
}) => {
  if (!ONESIGNAL_APP_ID) {
    throw new Error('ONESIGNAL_APP_ID environment variable is not set');
  }

  const recipients = emails.map((e) => e.trim()).filter(Boolean);
  if (recipients.length === 0) {
    console.warn('No email recipients for templated notification');
    return null;
  }

  console.log('Send email to addresses...');
  return await sendEmailByAlias({
    app_id: ONESIGNAL_APP_ID,
    alias: { include_email_tokens: recipients },
    content: { template_id: templateId, custom_data: customData },
  });
};
