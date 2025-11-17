'use server';

import type { PushParamsForAlias, PushParamsForSegment } from './types';
import { Notification } from '@onesignal/node-onesignal';
import { notify } from './notify';

export async function sendPushByAlias({
  app_id,
  alias,
  content,
  filters,
}: PushParamsForAlias) {
  const params = {
    app_id,
    ...alias,
    ...content,
    filters,
  };

  return await sendPush(params);
}

export async function sendPushBySegment({
  app_id,
  segment,
  content,
  filters,
}: PushParamsForSegment) {
  const params = {
    app_id,
    ...segment,
    ...content,
    filters,
  };

  return await sendPush(params);
}

async function sendPush(params: Partial<Notification>) {
  const notification = new Notification();

  Object.assign(notification, params);
  notification.target_channel = 'push';

  return await notify(notification);
}
