'use client';

import { useRef } from 'react';
import { useOnesignal } from './use-onesignal';

export function useLanguage() {
  const { onesignal } = useOnesignal();

  const getLanguage = useRef(onesignal?.User.getLanguage);
  const setLanguage = useRef(onesignal?.User.setLanguage);

  return { getLanguage: getLanguage.current, setLanguage: setLanguage.current };
}
