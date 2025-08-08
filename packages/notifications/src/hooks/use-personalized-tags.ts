'use client';

import { useState, useEffect } from 'react';
import OneSignal from 'react-onesignal';

export function usePersonalizedTags() {
  const [addTag, setTagAdder] = useState<
    ((key: string, value: string) => void) | undefined
  >(undefined);
  const [removeTag, setTagRemover] = useState<
    ((tag: string) => void) | undefined
  >(undefined);
  const [getTags, setTagsGetter] = useState<
    (() => Record<string, string>) | undefined
  >(undefined);

  useEffect(() => {
    const { addTag, removeTag, getTags } = OneSignal.User;

    setTagAdder(addTag);
    setTagRemover(removeTag);
    setTagsGetter(getTags);
  }, [OneSignal.User]);

  return { addTag, removeTag, getTags };
}
