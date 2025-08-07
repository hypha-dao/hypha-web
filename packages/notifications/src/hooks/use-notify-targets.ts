'use client';

import OneSignal from 'react-onesignal';

export function useNotifyTargets() {
  const { addEmail, removeEmail, addSms, removeSms } = OneSignal.User;

  return { addEmail, removeEmail, addSms, removeSms };
}
