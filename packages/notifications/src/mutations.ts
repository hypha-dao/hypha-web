'use server';

import { ProposalCreationProps } from './template';
import { sendPushByAlias } from './sdk/send-push';
import { sendEmailByAlias } from './sdk/send-email';
import { LangMap } from './sdk/types';

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';

export interface SendNotificationsInput extends ProposalCreationProps {
  proposalCreatorSlug?: string;
}

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
  return await sendPushByAlias({
    app_id: ONESIGNAL_APP_ID,
    alias: {
      include_aliases: {
        external_id: usernames,
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
  return await sendEmailByAlias({
    app_id: ONESIGNAL_APP_ID,
    alias: {
      include_aliases: {
        external_id: usernames,
      },
    },
    content: { email_body: body, email_subject: subject },
  });
};
