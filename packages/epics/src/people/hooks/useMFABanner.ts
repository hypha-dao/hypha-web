'use client';

import { useState, useEffect } from 'react';
import { useMfaEnrollment, usePrivy } from '@privy-io/react-auth';
import { useMe } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { ProfileComponentParams } from '../components/types';

export const useMFABanner = () => {
  const { personSlug: personSlugRaw } = useParams<ProfileComponentParams>();
  const personSlug = decodeURIComponent(personSlugRaw);
  const { isMe } = useMe();
  const { user } = usePrivy();
  const { showMfaEnrollmentModal } = useMfaEnrollment();
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

  const shouldHideDueToDismiss = dismissedUntil > Date.now();
  const hasMfaMethods = user && user.mfaMethods && user.mfaMethods.length > 0;
  const isVisible =
    !shouldHideDueToDismiss && !hasMfaMethods && isMe(personSlug);

  const onClose = () => {
    setDismissedUntil(Date.now() + 12 * 60 * 60 * 1000);
  };

  return { onClose, isVisible, showMfaEnrollmentModal };
};
