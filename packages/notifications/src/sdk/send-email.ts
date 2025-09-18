'use server';

import type { EmailParamsForAlias, EmailParamsForSegment } from './types';
import { Notification } from '@onesignal/node-onesignal';
import { notify } from './notify';

export async function sendEmailByAlias({
  app_id,
  alias,
  content,
}: EmailParamsForAlias) {
  const params = {
    app_id,
    ...alias,
    ...content,
  };

  return await sendEmail(params);
}

export async function sendEmailBySegment({
  app_id,
  segment,
  content,
}: EmailParamsForSegment) {
  const params = {
    app_id,
    ...segment,
    ...content,
  };

  return await sendEmail(params);
}

async function sendEmail(params: Partial<Notification>) {
  const notification = new Notification();

  Object.assign(notification, params);
  notification.target_channel = 'email';

  return await notify(notification);
}
