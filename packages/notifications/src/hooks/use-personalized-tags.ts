'use client';

import { useRef } from 'react';
import { useOnesignal } from './use-onesignal';

export function usePersonalizedTags() {
  const { onesignal } = useOnesignal();

  const addTag = useRef(onesignal?.User.addTag);
  const removeTag = useRef(onesignal?.User.removeTag);
  const getTags = useRef(onesignal?.User.getTags);

  return {
    addTag: addTag.current,
    removeTag: removeTag.current,
    getTags: getTags.current,
  };
}
