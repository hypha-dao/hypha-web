'use client';

import { useState, useEffect } from 'react';
import OneSignal from 'react-onesignal';

export function useNotifyTargets() {
  const [addEmail, setEmailAdder] = useState<
    ((email: string) => void) | undefined
  >(undefined);
  const [removeEmail, setEmailRemover] = useState<
    ((email: string) => void) | undefined
  >(undefined);
  const [addSms, setSmsAdder] = useState<((sms: string) => void) | undefined>(
    undefined,
  );
  const [removeSms, setSmsRemover] = useState<
    ((sms: string) => void) | undefined
  >(undefined);

  useEffect(() => {
    const { addEmail, removeEmail, addSms, removeSms } = OneSignal.User;

    setEmailAdder(addEmail);
    setEmailRemover(removeEmail);
    setSmsAdder(addSms);
    setSmsRemover(removeSms);
  }, [OneSignal.User]);

  return { addEmail, removeEmail, addSms, removeSms };
}
