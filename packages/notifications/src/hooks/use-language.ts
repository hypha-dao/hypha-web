'use client';

import { useState, useEffect } from 'react';
import OneSignal from 'react-onesignal';

export function useLanguage() {
  const [getLanguage, setLanguageGetter] = useState<(() => string) | undefined>(
    undefined,
  );
  const [setLanguage, setLanguageSetter] = useState<
    ((language: string) => void) | undefined
  >(undefined);

  useEffect(() => {
    const { getLanguage: getter, setLanguage: setter } = OneSignal.User;

    setLanguageGetter(getter);
    setLanguageSetter(setter);
  }, [OneSignal.User]);

  return { getLanguage, setLanguage };
}
