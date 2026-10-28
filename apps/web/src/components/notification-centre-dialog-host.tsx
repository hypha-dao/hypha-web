'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  DIALOG_PARAM,
  NOTIFICATION_CENTRE_DIALOG,
  buildDialogCloseHref,
} from '@hypha-platform/epics';
import AsideNotificationCentrePage from './aside-notification-centre-page';

/**
 * Single host for the Notification Centre, driven by `?dialog=notification-centre` so it opens
 * on any route. Unknown `dialog` values render nothing and are left in the URL.
 */
export function NotificationCentreDialogHost() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const closeUrl = buildDialogCloseHref(pathname, searchParams);
  const onClose = useCallback(() => {
    router.replace(closeUrl, { scroll: false });
  }, [router, closeUrl]);

  if (searchParams.get(DIALOG_PARAM) !== NOTIFICATION_CENTRE_DIALOG) {
    return null;
  }
  return <AsideNotificationCentrePage closeUrl={closeUrl} onClose={onClose} />;
}
