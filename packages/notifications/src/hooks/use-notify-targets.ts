'use client';

import { useRef } from 'react';
import { useOnesignal } from './use-onesignal';

export function useNotifyTargets() {
  const { onesignal } = useOnesignal();

  const addEmail = useRef(onesignal?.User.addEmail);
  const removeEmail = useRef(onesignal?.User.removeEmail);
  const addSms = useRef(onesignal?.User.addSms);
  const removeSms = useRef(onesignal?.User.removeSms);

  return {
    addEmail: addEmail.current,
    removeEmail: removeEmail.current,
    addSms: addSms.current,
    removeSms: removeSms.current,
  };
}
