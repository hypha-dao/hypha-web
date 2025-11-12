'use server';

import { ProposalCreationProps } from '../template';
import { sendPushByAlias } from './send-push';
import { sendEmailByAlias } from './send-email';
import { LangMap } from './types';

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';

export interface SendNotificationsInput extends ProposalCreationProps {
  proposalCreatorSlug?: string;
}

export const sendPushNotifications = async ({
  contents,
  headings,
  username,
}: {
  contents: LangMap;
  headings?: LangMap;
  username?: string;
}) => {
  return await sendPushByAlias({
    app_id: ONESIGNAL_APP_ID,
    alias: {
      include_aliases: { external_id: [username!] },
    },
    content: { contents, headings },
  });
};

export const sentEmailNotifications = async ({
  body,
  subject,
  username,
}: {
  body: string;
  subject: string;
  username?: string;
}) => {
  return await sendEmailByAlias({
    app_id: ONESIGNAL_APP_ID,
    alias: {
      include_aliases: { external_id: [username!] },
    },
    content: { email_body: body, email_subject: subject },
  });
};
