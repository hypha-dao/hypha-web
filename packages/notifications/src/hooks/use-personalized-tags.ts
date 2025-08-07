'use client';

import OneSignal from 'react-onesignal';

export function usePersonalizedTags() {
  const { addTag, addTags, removeTag, removeTags, getTags } = OneSignal.User;

  return { addTag, addTags, removeTag, removeTags, getTags };
}
