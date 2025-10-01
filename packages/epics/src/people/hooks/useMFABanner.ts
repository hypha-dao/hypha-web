'use client';

import { useState, useEffect } from 'react';

export const useMFABanner = () => {
  const storageKey = 'mfaBannerDismissedUntil';

  const [dismissedUntil, setDismissedUntil] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? parseInt(saved, 10) : 0;
    } catch (err) {
      console.error('Error reading from localStorage:', err);
      return 0;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (dismissedUntil > 0) {
        window.localStorage.setItem(storageKey, dismissedUntil.toString());
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch (err) {
      console.error('Error writing to localStorage:', err);
    }
  }, [dismissedUntil]);

  const shouldHide = dismissedUntil > Date.now();

  const onClose = () => {
    setDismissedUntil(Date.now() + 24 * 60 * 60 * 1000);
  };

  return { onClose, isVisible: !shouldHide };
};
