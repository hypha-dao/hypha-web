'use server';

import type { PushParamsForAlias, PushParamsForSegment } from './types';
import { Notification } from '@onesignal/node-onesignal';
import { notify } from './notify';

export async function sendPushByAlias({
  app_id,
  alias,
  content,
  url,
}: PushParamsForAlias) {
  const params = {
    app_id,
    ...alias,
    ...content,
    url,
  };

  return await sendPush(params);
}

export async function sendPushBySegment({
  app_id,
  segment,
  content,
  url,
}: PushParamsForSegment) {
  const params = {
    app_id,
    ...segment,
    ...content,
    url,
  };

  return await sendPush(params);
}

async function sendPush(params: Partial<Notification>) {
  const notification = new Notification();

  Object.assign(notification, params);
  notification.target_channel = 'push';
  notification.headings = {
    en: 'Hypha',
  };

  return await notify(notification);
}
