'use server';

import type { EmailParamsForAlias, EmailParamsForSegment } from './types';
import { Notification } from '@onesignal/node-onesignal';
import { notify } from './notify';

export async function sendEmailByAlias({
  app_id,
  alias,
  content,
  filters,
}: EmailParamsForAlias) {
  const params = {
    app_id,
    ...alias,
    ...content,
    filters,
  };

  return await sendEmail(params);
}

export async function sendEmailBySegment({
  app_id,
  segment,
  content,
  filters,
}: EmailParamsForSegment) {
  const params = {
    app_id,
    ...segment,
    ...content,
    filters,
  };

  return await sendEmail(params);
}

async function sendEmail(params: Partial<Notification>) {
  const notification = new Notification();

  Object.assign(notification, params);
  notification.target_channel = 'email';

  return await notify(notification);
}
