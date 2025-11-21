'use client';

import { useMe } from '@hypha-platform/core/client';
import { NotificationCentreForm, SidePanel } from '@hypha-platform/epics';
import { useNotifications } from '@hypha-platform/notifications/client';
import { LoadingBackdrop } from '@hypha-platform/ui';
import { usePathname } from 'next/navigation';

export default function AsideNotificationCentrePage() {
  const { person, isLoading: isPersonLoading } = useMe();
  const pathname = usePathname();
  const closeUrl = pathname.substring(0, pathname.lastIndexOf('/'));
  const {
    subscribed,
    subscribe,
    unsubscribe,
    error,
    configuration,
    saveConfigurations,
  } = useNotifications();
  const progress = 0;
  const isBusy = isPersonLoading;
  return (
    <SidePanel>
      <LoadingBackdrop
        progress={progress}
        isLoading={isBusy}
        message={<></>}
        className="-m-4 lg:-m-7"
      >
        <NotificationCentreForm
          person={person}
          closeUrl={closeUrl}
          isLoading={isBusy}
          error={error}
          subscribed={subscribed}
          subscribe={subscribe}
          unsubscribe={unsubscribe}
          configuration={configuration}
          saveConfigurations={saveConfigurations}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
