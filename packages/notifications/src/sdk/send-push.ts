'use server';

import type { Push } from './types';
import { Notification } from '@onesignal/node-onesignal';
import { notify } from './notify';

export async function sendPush(params: Push) {
  const notification = new Notification();

  for (const [key, value] of Object.entries(params)) {
    (notification as any)[key as keyof typeof notification] = value as any;
  }

  return await notify(notification);
}
