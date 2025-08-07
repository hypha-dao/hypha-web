'use client';

import OneSignal from 'react-onesignal';

export function useLanguage() {
  const { getLanguage, setLanguage } = OneSignal.User;

  return { getLanguage, setLanguage };
}
