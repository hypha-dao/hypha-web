'use server';

import type { Email } from './types';
import { Notification } from '@onesignal/node-onesignal';
import { notify } from './notify';

export async function sendEmail(params: Email) {
  const notification = new Notification();

  for (const key in params) {
    if (notification.hasOwnProperty(key)) {
      notification[key] = params[key];
    }
  }

  return await notify(notification);
}
