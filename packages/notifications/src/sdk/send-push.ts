'use server';

import type { Push } from './types';
import { Notification } from '@onesignal/node-onesignal';
import { notify } from './notify';

export async function sendPush(params: Push) {
  const notification = new Notification();

  for (const key in params) {
    if (notification.hasOwnProperty(key)) {
      notification[key] = params[key];
    }
  }

  return await notify(notification);
}
